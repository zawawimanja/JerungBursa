const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { collectPortfolioAlerts, runPortfolioAlerts, sendTelegram } = require('./portfolio_alert');

const position = { name: 'EXAMPLE', buyPrice: 1, slPrice: 0.95, allocation: 2000, tp1: 1.1, tp2: 1.2 };
const now = new Date('2026-10-12T16:05:00Z'); // 13 October in Malaysia
const env = { TELEGRAM_BOT_TOKEN: 'test-bot-secret', TELEGRAM_CHAT_ID: 'test-chat' };

function fixture(t, live = { topVolume: [{ name: 'EXAMPLE', price: 1.11 }] }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jerung-portfolio-alert-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'user_portfolio.json'), JSON.stringify([position]));
    fs.writeFileSync(path.join(dir, 'live_data.json'), JSON.stringify(live));
    const legacy = JSON.stringify({ '2026-09-11_EXAMPLE_BE': true }, null, 2);
    fs.writeFileSync(path.join(dir, 'portfolio_alerts_history.json'), legacy);
    const logs = [];
    const logger = { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) };
    return { dir, legacy, logs, options: { appDir: dir, now, env, logger }, state: path.join(dir, 'portfolio_alerts_state.json') };
}

test('Portfolio alerts are acknowledged only after a confirmed send and never modify tracked legacy history', async t => {
    const f = fixture(t);
    const messages = [];
    const send = async (token, chatId, message) => {
        assert.equal(token, env.TELEGRAM_BOT_TOKEN);
        assert.equal(chatId, env.TELEGRAM_CHAT_ID);
        assert.equal(fs.existsSync(f.state), false);
        messages.push(message);
        return { ok: true };
    };
    assert.deepEqual(await runPortfolioAlerts({ ...f.options, send }), { sent: true, alerts: 1 });
    const history = JSON.parse(fs.readFileSync(f.state, 'utf8'));
    assert.equal(history['2026-10-13_EXAMPLE_TP1'], true);
    assert.equal(history['2026-09-11_EXAMPLE_BE'], true);
    assert.equal(fs.readFileSync(path.join(f.dir, 'portfolio_alerts_history.json'), 'utf8'), f.legacy);
    assert.match(messages[0], /2026-10-13 00:05 MYT/);
    assert.match(messages[0], /baki 50% ke paras TP1 RM 1\.100/);
    assert.deepEqual(await runPortfolioAlerts({ ...f.options, send }), { sent: false, alerts: 0 });
    assert.equal(messages.length, 1);
});

test('A dry run without credentials leaves every milestone pending for a later real send', async t => {
    const f = fixture(t);
    let sent = 0;
    const send = async () => { sent++; return { ok: true }; };
    const dry = await runPortfolioAlerts({ ...f.options, env: {}, send });
    assert.equal(dry.reason, 'missing-credentials');
    assert.equal(sent, 0);
    assert.equal(fs.existsSync(f.state), false);
    assert.equal((await runPortfolioAlerts({ ...f.options, send })).sent, true);
    assert.equal(sent, 1);
});

test('Rejected or failed Telegram delivery leaves milestones retryable and logs no token or request details', async t => {
    for (const send of [async () => ({ ok: false }), async () => { throw new Error('https://api.telegram.org/bottest-bot-secret/sendMessage failed'); }]) {
        const f = fixture(t);
        const failed = await runPortfolioAlerts({ ...f.options, send });
        assert.equal(failed.reason, 'send-failed');
        assert.equal(fs.existsSync(f.state), false);
        assert.doesNotMatch(JSON.stringify(f.logs), /test-bot-secret/);
        assert.equal((await runPortfolioAlerts({ ...f.options, send: async () => ({ ok: true }) })).sent, true);
    }
});

test('Legacy same-day acknowledgements remain read-only and suppress duplicates', async t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.dir, 'portfolio_alerts_history.json'), JSON.stringify({ '2026-10-13_EXAMPLE_TP1': true }));
    const result = await runPortfolioAlerts({ ...f.options, send: async () => { throw new Error('Must not send'); } });
    assert.equal(result.alerts, 0);
    assert.equal(fs.existsSync(f.state), false);
});

test('Missing or invalid quotes cannot fabricate entry-price SL alerts; every live scanner group is considered', async t => {
    const f = fixture(t, { topVolume: [], topGainers: [{ name: 'EXAMPLE', price: 1.11 }] });
    assert.equal((await runPortfolioAlerts({ ...f.options, send: async () => ({ ok: true }) })).sent, true);
    const raisedStop = { ...position, slPrice: 1.1 };
    for (const rows of [[], [{ name: 'EXAMPLE', price: null }], [{ name: 'EXAMPLE', price: '1.1' }], [{ name: 'EXAMPLE', price: Infinity }]]) {
        assert.deepEqual(collectPortfolioAlerts([raisedStop], rows, {}, '2026-10-13'), []);
    }
    assert.deepEqual(collectPortfolioAlerts([{ ...position, buyPrice: 0 }], [{ name: 'EXAMPLE', price: 1.11 }], {}, '2026-10-13'), []);
});

test('Portfolio milestones cover the 9.5%-TP1 gap and preserve TP/SL decisions without mutating history', () => {
    const history = {};
    for (const [price, expected] of [[1.05, 'BE'], [1.097, 'BE'], [1.1, 'TP1'], [1.2, 'TP2'], [0.95, 'SL_HIT'], [0.96, 'SL_NEAR']]) {
        const alerts = collectPortfolioAlerts([position], [{ name: 'example', price }], history, '2026-10-13');
        assert.deepEqual(alerts.map(alert => alert.type), [expected]);
    }
    assert.deepEqual(history, {});
    const trailed = collectPortfolioAlerts([{ ...position, slPrice: 1.1 }], [{ name: 'EXAMPLE', price: 1.09 }], {}, '2026-10-13');
    assert.deepEqual(trailed.map(alert => alert.type), ['SL_HIT']);
});

function transport({ statusCode = 200, body = '{"ok":true}', error, hang = false } = {}) {
    let destroyed = false;
    return {
        get destroyed() { return destroyed; },
        request(url, options, onResponse) {
            const request = new EventEmitter();
            request.write = () => {};
            request.destroy = () => { destroyed = true; };
            request.end = () => {
                if (hang) return;
                setImmediate(() => {
                    if (error) return request.emit('error', error);
                    const response = new EventEmitter();
                    response.statusCode = statusCode;
                    onResponse(response);
                    response.emit('data', body);
                    response.emit('end');
                });
            };
            return request;
        }
    };
}

test('Telegram transport confirms both HTTP status and ok=true before accepting delivery', async () => {
    assert.deepEqual(await sendTelegram('fake', 'fake', 'Alert', { httpsClient: transport() }), { ok: true });
    for (const scenario of [{ statusCode: 401 }, { body: '{"ok":false}' }, { body: '<html>Error</html>' }, { error: new Error('offline') }]) {
        await assert.rejects(sendTelegram('fake', 'fake', 'Alert', { httpsClient: transport(scenario) }));
    }
});

test('A hung Telegram request expires and destroys its transport', async () => {
    const httpsClient = transport({ hang: true });
    await assert.rejects(sendTelegram('fake', 'fake', 'Alert', { httpsClient, timeoutMs: 5 }), /timed out/);
    assert.equal(httpsClient.destroyed, true);
});
