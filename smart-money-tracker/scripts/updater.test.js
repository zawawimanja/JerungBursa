const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { MARKET_SCRIPTS, runMarketPipeline } = require('./lib/market_pipeline');
const { createLiveUpdater, publishData, DATA_PATHS } = require('./run_live_updater');

function harness(time = '2026-10-13T09:50:00Z', failAt = '') {
    const calls = [], errors = [];
    const runCommand = async (command, args) => {
        const stage = command === 'git' ? args[0] : path.basename(args[0]);
        calls.push(stage);
        if (stage === failAt) throw new Error(`failed ${stage}`);
        return stage === 'branch' ? 'main' : '';
    };
    const updater = createLiveUpdater({ runCommand, now: () => new Date(time),
        publish: async () => { calls.push('publish'); if (failAt === 'publish') throw new Error('push failed'); },
        logger: { error: message => errors.push(message) } });
    return { updater, calls, errors };
}

test('Every update regenerates news and all trackers, including subsequent settlement corrections', async () => {
    const { updater, calls, errors } = harness();
    await updater();
    await updater();
    assert.deepEqual(errors, []);
    for (const script of MARKET_SCRIPTS) assert.equal(calls.filter(call => call === script).length, 2, script);
    assert.equal(calls.filter(call => call === 'publish').length, 2);
    assert.ok(calls.indexOf('generate_news_data.js') < calls.indexOf('generate_fresh_rider_tracker.js'));
    assert.ok(calls.indexOf('--test') < calls.indexOf('publish'));
    assert.ok(calls.indexOf('verify_scanner_tracker_sync.js') < calls.indexOf('publish'));
    assert.ok(calls.indexOf('publish') < calls.indexOf('portfolio_alert.js'));
});

test('Failed pipeline, checks or publication stop before any alert', async () => {
    for (const failAt of ['generate_news_data.js', '--test', 'verify_scanner_tracker_sync.js', 'publish']) {
        const { updater, calls, errors } = harness('2026-10-13T09:15:00Z', failAt);
        await updater();
        assert.equal(errors.length, 1, failAt);
        assert.ok(!calls.includes('buy_alert.js'), failAt);
        assert.ok(!calls.includes('portfolio_alert.js'), failAt);
        if (failAt !== 'publish') assert.ok(!calls.includes('publish'), failAt);
    }
});

test('The shared pipeline stops immediately when a prerequisite fails', async () => {
    const calls = [];
    await assert.rejects(runMarketPipeline(async (_command, args) => {
        const stage = path.basename(args[0]);
        calls.push(stage);
        if (stage === 'generate_news_data.js') throw new Error('news unavailable');
    }), /news unavailable/);
    assert.deepEqual(calls, MARKET_SCRIPTS.slice(0, 2));
});

test('Failed generation restores only owned data and the next cycle can recover', async () => {
    let dirty = false, attempts = 0;
    const restores = [], published = [];
    const updater = createLiveUpdater({ now: () => new Date('2026-10-13T09:50:00Z'),
        logger: { error() {} }, publish: async () => published.push(true),
        runCommand: async (command, args) => {
            if (command === 'git') {
                if (args[0] === 'status') return dirty ? ' M smart-money-tracker/live_data.json' : '';
                if (args[0] === 'branch') return 'main';
                if (args[0] === 'restore') { restores.push(args); dirty = false; }
            } else if (path.basename(args[0]) === 'scrape-real.js') dirty = true;
            else if (path.basename(args[0]) === 'generate_news_data.js' && ++attempts === 1) throw new Error('temporary failure');
            return '';
        } });
    await updater();
    assert.equal(dirty, false);
    assert.deepEqual(restores[0].slice(3), DATA_PATHS);
    await updater();
    assert.equal(published.length, 1);
});

test('Pre-existing user edits are preserved and never trigger generated-data recovery', async () => {
    const calls = [];
    const updater = createLiveUpdater({ now: () => new Date('2026-10-13T09:50:00Z'),
        logger: { error() {} }, runCommand: async (_command, args) => {
            calls.push(args[0]); return ' M smart-money-tracker/live_data.json';
        } });
    await updater();
    assert.deepEqual(calls, ['status']);
});

test('Weekend, public holiday and out-of-hours updates never invoke subprocesses', async () => {
    for (const time of ['2026-10-17T02:00:00Z', '2026-09-16T02:00:00Z',
        '2026-10-13T00:29:00Z', '2026-10-13T10:15:00Z']) {
        const { updater, calls } = harness(time);
        await updater();
        assert.deepEqual(calls, [], time);
    }
});

test('Overlapping updates are skipped and failed buy alerts are retried', async () => {
    const { updater, calls } = harness('2026-10-13T09:15:00Z', 'buy_alert.js');
    await Promise.all([updater(), updater()]);
    assert.equal(calls.filter(call => call === 'scrape-real.js').length, 1);
    await updater();
    assert.equal(calls.filter(call => call === 'buy_alert.js').length, 2);
});

test('Publication includes whale/news assets and limits commits to market files', async () => {
    const calls = [];
    await publishData(async (_command, args) => {
        calls.push(args);
        return args[0] === 'diff' ? 'smart-money-tracker/news_data.js' : '';
    }, { log() {} });
    for (const file of ['news_data.js', 'jerung-data.json', 'jerung-data.js']) {
        assert.ok(DATA_PATHS.includes(`smart-money-tracker/${file}`));
    }
    const commit = calls.find(args => args[0] === 'commit');
    assert.ok(commit.includes('--only'));
    assert.deepEqual(commit.slice(commit.indexOf('--') + 1), DATA_PATHS);
});
