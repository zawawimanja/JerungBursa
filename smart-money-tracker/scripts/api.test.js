const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load each function in isolation: these tests never install Axios, contact a
// provider, dispatch an action, or read real environment credentials.
function endpoint(file, options = {}) {
    const calls = [];
    const logs = [];
    let now = 1000000;
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const context = {
        module: { exports: {} }, Buffer, Date: Clock,
        process: { env: options.env || {} },
        console: { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
        require: name => {
            if (name === 'axios') return { post: async (...args) => {
                calls.push(args);
                return options.post ? options.post(...args) : (file === 'chat' ? { data: { choices: [{ message: { content: 'Analysis ready.' } }] } } : { status: 204 });
            } };
            if (name === 'node:net' || name === 'node:crypto') return require(name);
            throw new Error(`Unexpected dependency: ${name}`);
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'api', `${file}.js`), 'utf8'), context, { filename: file });
    return {
        calls, logs,
        advance: ms => { now += ms; },
        request: async overrides => {
            const req = { method: file === 'chat' ? 'POST' : 'GET', headers: {}, ...overrides };
            const res = {
                statusCode: 200, headers: {}, body: undefined,
                setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
                status(code) { this.statusCode = code; return this; },
                json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; },
                end() { return this; }
            };
            await context.module.exports(req, res);
            return res;
        }
    };
}

const chatEnv = { GROQ_API_KEY: 'test-groq-secret' };
const cronEnv = { CRON_SECRET: 'test-cron-secret', GITHUB_TOKEN: 'test-github-secret' };
const authorized = { headers: { authorization: 'Bearer test-cron-secret' } };

test('Chat validates JSON, prompt and content type without using provider quota', async () => {
    const api = endpoint('chat', { env: chatEnv });
    for (const body of ['{bad json', 'null', '[]', [], null, { prompt: '   ' }, { prompt: 12 }, { prompt: 'x'.repeat(15001) }]) {
        assert.equal((await api.request({ body })).statusCode, 400);
    }
    assert.equal((await api.request({ headers: { 'content-type': 'text/plain' }, body: { prompt: 'Hello' } })).statusCode, 415);
    assert.equal((await api.request({ headers: { 'content-type': ['application/json'] }, body: { prompt: 'Hello' } })).statusCode, 415);
    assert.equal(api.calls.length, 0);
    for (let i = 0; i < 10; i++) assert.equal((await api.request({ body: { prompt: 'Hello' } })).statusCode, 200);
});

test('Chat parses the browser payload and clamps unsupported model, token and temperature options', async () => {
    const api = endpoint('chat', { env: chatEnv });
    const result = await api.request({ headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ prompt: 'Hello', model: 'arbitrary-model', max_tokens: 9999.9, temperature: -1, systemPrompt: 's'.repeat(5000) }) });
    assert.equal(result.body.text, 'Analysis ready.');
    assert.equal(result.headers['access-control-allow-origin'], '*');
    assert.equal(result.headers['cache-control'], 'no-store');
    const [, payload, config] = api.calls[0];
    assert.equal(payload.model, 'llama-3.3-70b-versatile');
    assert.equal(payload.max_tokens, 2048);
    assert.equal(payload.temperature, 0);
    assert.equal(payload.messages[0].content.length, 5000);
    assert.equal(config.timeout, 20000);
    assert.equal(config.headers.Authorization, 'Bearer test-groq-secret');
    await api.request({ body: { prompt: 'Hello', model: 'llama-3.1-8b-instant', max_tokens: '123junk', temperature: 'invalid', systemPrompt: 's'.repeat(5001) } });
    assert.equal(api.calls[1][1].model, 'llama-3.1-8b-instant');
    assert.equal(api.calls[1][1].max_tokens, 1024);
    assert.equal(api.calls[1][1].temperature, 0.5);
    assert.match(api.calls[1][1].messages[0].content, /JerungBursa AI/);
    await api.request({ body: { prompt: 'Hello', max_tokens: '1' } });
    assert.equal(api.calls[2][1].max_tokens, 64);
});

test('Chat normalizes proxy chains into one rate limit and resets exactly on the deadline', async () => {
    const api = endpoint('chat', { env: chatEnv });
    for (let i = 0; i < 10; i++) {
        const forwarded = ` 203.0.113.1 , 10.0.0.${i}`;
        assert.equal((await api.request({ headers: { 'x-forwarded-for': i % 2 ? [forwarded] : forwarded }, body: { prompt: 'Hello' } })).statusCode, 200);
    }
    const limited = await api.request({ headers: { 'x-forwarded-for': '203.0.113.1, 10.0.1.2' }, body: { prompt: 'Hello' } });
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['retry-after'], '300');
    assert.equal(api.calls.length, 10);
    api.advance(300000);
    assert.equal((await api.request({ headers: { 'x-forwarded-for': '203.0.113.1' }, body: { prompt: 'Hello' } })).statusCode, 200);
});

test('Chat treats malformed proxy headers as the same socket client', async () => {
    const api = endpoint('chat', { env: chatEnv });
    for (let i = 0; i < 10; i++) await api.request({ headers: { 'x-forwarded-for': { i } }, socket: { remoteAddress: '203.0.113.2' }, body: { prompt: 'Hello' } });
    assert.equal((await api.request({ headers: null, socket: { remoteAddress: '203.0.113.2' }, body: { prompt: 'Hello' } })).statusCode, 429);
});

test('Chat refuses empty or malformed provider responses', async () => {
    for (const content of [undefined, null, '', '   ', [], {}]) {
        const api = endpoint('chat', { env: chatEnv, post: async () => ({ data: { choices: [{ message: { content } }] } }) });
        const res = await api.request({ body: { prompt: 'Hello' } });
        assert.equal(res.statusCode, 502);
        assert.equal(res.body.text, undefined);
    }
});

test('Chat reports timeouts and rate limits without leaking provider credentials or error messages', async () => {
    for (const [failure, expected] of [[{ code: 'ECONNABORTED' }, 504], [{ code: 'ETIMEDOUT' }, 504], [{ response: { status: 429 } }, 429], [{ response: { status: 401 } }, 502], [null, 502]]) {
        const error = failure && { ...failure, message: 'test-groq-secret', config: { headers: { Authorization: 'Bearer test-groq-secret' } } };
        const api = endpoint('chat', { env: chatEnv, post: async () => { throw error; } });
        const res = await api.request({ body: { prompt: 'Hello' } });
        assert.equal(res.statusCode, expected);
        assert.doesNotMatch(JSON.stringify([res.body, api.logs]), /test-groq-secret/);
        if (expected === 429) assert.equal(res.headers['retry-after'], '30');
    }
});

test('Chat handles preflight, unsupported methods and missing configuration without provider requests', async () => {
    const api = endpoint('chat');
    const preflight = await api.request({ method: 'OPTIONS' });
    assert.equal(preflight.statusCode, 200);
    assert.equal(preflight.headers['access-control-allow-methods'], 'POST, OPTIONS');
    const unsupported = await api.request({ method: 'GET' });
    assert.equal(unsupported.statusCode, 405);
    assert.equal(unsupported.headers.allow, 'POST, OPTIONS');
    assert.equal((await api.request({ body: { prompt: 'Hello' } })).statusCode, 500);
    const blankKey = endpoint('chat', { env: { GROQ_API_KEY: '   ' } });
    assert.equal((await blankKey.request({ body: { prompt: 'Hello' } })).statusCode, 500);
    assert.equal(blankKey.calls.length, 0);
    assert.equal(api.calls.length, 0);
});

test('Cron fails closed when authentication is not configured and rejects malformed credentials', async () => {
    for (const env of [{ GITHUB_TOKEN: 'test-github-secret' }, { ...cronEnv, CRON_SECRET: '   ' }]) {
        const api = endpoint('cron-scrape', { env });
        assert.equal((await api.request({})).statusCode, 503);
        assert.equal(api.calls.length, 0);
    }
    const api = endpoint('cron-scrape', { env: cronEnv });
    for (const input of [{}, { headers: null }, { headers: { authorization: ['Bearer test-cron-secret'] } }, { query: { secret: ['test-cron-secret'] } }, { query: { secret: 'wrong' } }]) {
        assert.equal((await api.request(input)).statusCode, 401);
    }
    assert.equal(api.calls.length, 0);
});

test('Cron preserves valid authorization and dispatch aliases with bounded provider requests', async () => {
    const api = endpoint('cron-scrape', { env: cronEnv });
    assert.equal((await api.request(authorized)).body.event_type, 'scrape_trigger');
    assert.equal((await api.request({ method: 'POST', query: { secret: 'test-cron-secret', job: 'BUY_ALERT' } })).body.event_type, 'buy_alert_trigger');
    assert.equal((await api.request({ ...authorized, query: { type: 'close' } })).body.event_type, 'buy_alert_trigger');
    assert.equal((await api.request({ ...authorized, query: { event: 'scrape_trigger' } })).body.event_type, 'scrape_trigger');
    assert.equal(api.calls.length, 4);
    for (const [url, payload, config] of api.calls) {
        assert.match(url, /\/repos\/zawawimanja\/JerungBursa\/dispatches$/);
        assert.ok(['scrape_trigger', 'buy_alert_trigger'].includes(payload.event_type));
        assert.equal(config.timeout, 15000);
        assert.equal(config.headers.Authorization, 'Bearer test-github-secret');
    }
});

test('Cron rejects ambiguous or unknown jobs rather than accidentally triggering buy alerts', async () => {
    const api = endpoint('cron-scrape', { env: cronEnv });
    for (const job of [['buy_alert'], {}, 1, null, 'dont_buy_alert', 'unclosed', 'morning_malicious']) {
        assert.equal((await api.request({ ...authorized, query: { job } })).statusCode, 400);
    }
    assert.equal(api.calls.length, 0);
});

test('Retired morning cron needs authorization but no GitHub token or dispatch', async () => {
    const api = endpoint('cron-scrape', { env: { CRON_SECRET: cronEnv.CRON_SECRET } });
    assert.equal((await api.request({ ...authorized, query: { job: 'morning_alert' } })).body.success, true);
    assert.equal((await api.request(authorized)).statusCode, 503);
    assert.equal(api.calls.length, 0);
    const fallback = endpoint('cron-scrape', { env: { CRON_SECRET: cronEnv.CRON_SECRET, GITHUB_TOKEN: '   ', GH_PAT: 'fallback-test-token' } });
    assert.equal((await fallback.request(authorized)).statusCode, 200);
    assert.equal(fallback.calls[0][2].headers.Authorization, 'Bearer fallback-test-token');
});

test('Cron confirms only the expected dispatch response and handles unsupported methods', async () => {
    const api = endpoint('cron-scrape', { env: cronEnv, post: async () => ({ status: 200 }) });
    assert.equal((await api.request({ method: 'DELETE' })).statusCode, 405);
    assert.equal((await api.request(authorized)).statusCode, 502);
});

test('Cron reports upstream failures without reflecting secret-bearing errors', async () => {
    for (const [failure, expected] of [[{ code: 'ECONNABORTED' }, 504], [{ code: 'ETIMEDOUT' }, 504], [{ response: { status: 429 } }, 429], [{ response: { status: 403, data: { message: 'test-github-secret' } } }, 502], [null, 502]]) {
        const error = failure && { ...failure, message: 'test-github-secret /?secret=test-cron-secret', config: { headers: { Authorization: 'Bearer test-github-secret' } } };
        const api = endpoint('cron-scrape', { env: cronEnv, post: async () => { throw error; } });
        const res = await api.request(authorized);
        assert.equal(res.statusCode, expected);
        assert.equal(res.body.success, false);
        assert.doesNotMatch(JSON.stringify([res.body, api.logs]), /test-github-secret|test-cron-secret/);
        if (expected === 429) assert.equal(res.headers['retry-after'], '60');
    }
});
