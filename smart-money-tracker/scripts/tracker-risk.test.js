const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const calendar = require('./lib/bursa_calendar');
const { trackerIssues } = require('./lib/tracker_audit');
const corporateRisk = require('./lib/corporate_risk');
const StrategyRules = require('./lib/strategy_rules');

const fixtureStock = overrides => ({
    name: 'DUFU', price: 1, floorLow: 0.99, change: 0, changePct: 0,
    isVvip: true, ipoYear: 2025, ipoAge: 300, touchCount: 4,
    turnover: 3000000, pullback: 2, closeTightness: 2,
    sma50: 0.8, isConsolidation: true, openPrice: 1,
    ...overrides
});

// Execute the real generators with an in-memory file system and no Yahoo/Telegram access.
function replay(generator, days, news = {}, backfillCalls = []) {
    const output = {};
    const history = Object.fromEntries(days.map(day => [`data_${day.date}.json`, JSON.stringify({ topVolume: day.rows })]));
    const fakeFs = {
        readdirSync: () => Object.keys(history),
        statSync: () => ({ size: 200001 }),
        existsSync: file => path.basename(file) === 'news_data.js',
        readFileSync(file) {
            const basename = path.basename(file);
            if (history[basename]) return history[basename];
            if (basename === 'symbol_mappings.json') return JSON.stringify({ DUFU: '7233.KL' });
            if (basename === 'news_data.js') return `window.NEWS_DATA = ${JSON.stringify(news)};`;
            throw new Error(`Unexpected fixture file: ${basename}`);
        },
        writeFileSync: (file, source) => { output[path.basename(file)] = source; }
    };
    const context = { __dirname, console: { log() {} }, require(name) {
        if (name === 'fs') return fakeFs;
        if (name === 'path') return path;
        if (name === 'vm') return vm;
        if (name === './lib/bursa_calendar') return calendar;
        if (name === './lib/corporate_risk') return corporateRisk;
        if (name === './lib/strategy_rules') return StrategyRules;
        if (name === './backfill_stale.js') return { backfillStaleTrades(...args) { backfillCalls.push(args); return 0; } };
        throw new Error(`Unexpected fixture dependency: ${name}`);
    } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, generator), 'utf8'), context, { timeout: 5000 });
    const results = { window: {} };
    for (const source of Object.values(output)) vm.runInNewContext(source, results);
    return results.window;
}

function tradingDates(count, start = '2026-06-02') {
    const dates = [];
    const date = new Date(`${start}T00:00:00Z`);
    while (dates.length < count) {
        const key = date.toISOString().slice(0, 10);
        if (calendar.isTradingDay(key)) dates.push(key);
        date.setUTCDate(date.getUTCDate() + 1);
    }
    return dates;
}

test('Appending future prices cannot rewrite historical ADD-ON eligibility or floor', () => {
    const dates = tradingDates(9);
    const days = dates.map((date, i) => ({ date, rows: [fixtureStock({ price: i < 3 ? 1 + i * 0.01 : 2 })] }));
    const short = replay('generate_fresh_rider_tracker.js', days.slice(0, 3)).ALL_TRACKER.trades;
    const long = replay('generate_fresh_rider_tracker.js', days).ALL_TRACKER.trades;
    const entries = trades => Array.from(trades).filter(t => t.entryDate <= dates[2]).map(t => `${t.entryDate}|${t.entryType}|${t.entryFloor}`).sort();
    assert.ok(short.some(t => t.entryDate === dates[1] && t.entryType.includes('ADD-ON')));
    assert.deepEqual(entries(long), entries(short));
});

test('Red volume spikes stay blocked when changePct is absent or conflicts with change', () => {
    for (const generator of ['generate_fresh_rider_tracker.js', 'generate_hot_theme_tracker.js']) {
        for (const change of [{ change: -0.02, changePct: undefined }, { change: 0, changePct: -2 }]) {
            const data = replay(generator, [{ date: '2026-10-13', rows: [fixtureStock({ ...change, hasVolumeSpike: true, volumeSpike: 2 })] }]);
            const tracker = generator.includes('fresh') ? data.ALL_TRACKER : data.HOT_THEME_TRACKER;
            assert.equal(tracker.trades.length, 0, `${generator}: ${JSON.stringify(change)}`);
        }
    }
});

test('Hyphenated listing dates preserve the IPO debut shield when ipoAge is missing', () => {
    const stock = fixtureStock({ listingDate: '21-Jul-2026', ipoAge: undefined, touchCount: 1 });
    const data = replay('generate_fresh_rider_tracker.js', [{ date: '2026-07-27', rows: [stock] }]);
    assert.equal(data.ALL_TRACKER.trades.length, 0);
});

test('FR and ADD-ON time stops evaluate the current day gain', () => {
    for (const [count, type] of [[60, '🔥 NEW'], [61, '⭐ ADD-ON A+']]) {
        const dates = tradingDates(count);
        const days = dates.map((date, i) => ({ date, rows: [fixtureStock({ price: i === count - 1 ? 1.055 : 1 })] }));
        const tracker = replay('generate_fresh_rider_tracker.js', days).ALL_TRACKER;
        const entry = tracker.trades.find(t => t.entryType === type && t.entryDate === dates[type.includes('ADD-ON') ? 1 : 0]);
        assert.equal(entry.days, 60);
        assert.equal(entry.finalGain, 5.5);
        assert.equal(entry.status, 'OPEN');
        assert.deepEqual(trackerIssues(tracker), []);
    }
});

test('Generator earnings checks distinguish a financial year-end change from an actual QR', () => {
    for (const generator of ['generate_fresh_rider_tracker.js', 'generate_hot_theme_tracker.js']) {
        const days = [{ date: '2026-10-13', rows: [fixtureStock()] }];
        const unrelated = { DUFU: { announcements: [{ date: '2026-10-13', category: 'Change in Financial Year End', title: 'Change in Financial Year End' }] } };
        const earnings = { DUFU: { announcements: [{ date: '2026-10-13', category: 'Financial Results', title: 'Quarterly report for the financial period ended' }] } };
        const key = generator.includes('fresh') ? 'ALL_TRACKER' : 'HOT_THEME_TRACKER';
        assert.equal(replay(generator, days, unrelated)[key].trades.length, 1);
        assert.equal(replay(generator, days, earnings)[key].trades.length, 0);
        const dividend = { DUFU: { entitlements: [{ isDividend: true, exDate: '04 Jan' }] } };
        assert.equal(replay(generator, [{ date: '2026-12-30', rows: [fixtureStock()] }], dividend)[key].trades.length, 0);
    }
});

test('Stale FR quotes retain the same floor and profit-lock stops as daily replay', () => {
    const calls = [];
    replay('generate_fresh_rider_tracker.js', [{ date: '2026-10-13', rows: [fixtureStock()] }], {}, calls);
    assert.equal(calls.length, 2);
    for (const [, , exit, options] of calls) {
        assert.equal(options.exitAtClose, true);
        assert.equal(exit({ entry: 1, entryFloor: 0.99, high: 1, maxGain: 0 }), 0.99 * 0.97);
        assert.equal(exit({ entry: 1, entryFloor: 0.99, high: 1.05, maxGain: 5 }), 1);
        assert.equal(exit({ entry: 1, entryFloor: 0.99, high: 1.1, maxGain: 10 }), 1.1);
    }
});

test('Backfilled FR exits use observed close and retain HT existing stop-price behavior', () => {
    const source = fs.readFileSync(path.join(__dirname, 'backfill_stale.js'), 'utf8');
    const context = { __dirname, module: { exports: {} }, console: { log() {} }, require(name) {
        if (name === 'path') return path;
        if (name === 'child_process') return { execSync: () => JSON.stringify({ '5354.KL': { date: '2026-10-13', close: 0.98 } }) };
        throw new Error(name);
    } };
    vm.runInNewContext(source, context);
    const backfill = context.module.exports.backfillStaleTrades;
    const makeTrade = () => ({ name: 'STRATUS', entryDate: '2026-10-01', lastDate: '2026-10-12', highDate: '2026-10-12', entry: 1, currentPrice: 1.05, high: 1.05, finalGain: 5, status: 'OPEN' });
    const fr = makeTrade(), ht = makeTrade();
    backfill([fr], '2026-10-13', () => 1, { exitAtClose: true });
    backfill([ht], '2026-10-13', () => 1);
    assert.equal(fr.status, 'CLOSED_SL');
    assert.equal(fr.exitPrice, 0.98);
    assert.equal(fr.finalGain, -2);
    assert.equal(ht.exitPrice, 1);
    assert.equal(ht.finalGain, 0);
    const cached = makeTrade();
    backfill([cached], '2026-10-13', () => 1, { exitAtClose: true, quotes: { '5354.KL': { close: 1.04, date: '2026-10-13' } } });
    assert.equal(cached.currentPrice, 1.04);
    assert.equal(cached.status, 'OPEN');
    assert.equal(cached.lastDate, '2026-10-13');
});

test('Trade audit rejects impossible dates, incorrect PnL and mismatched summary totals', () => {
    const trade = { name: 'DUFU', entryType: 'NEW', entryDate: '2026-10-01', lastDate: '2026-10-13', highDate: '2026-10-13', entry: 1, currentPrice: 1.1, high: 1.1, finalGain: 10, status: 'OPEN' };
    const summary = { totalTracked: 1, openCount: 1, closedCount: 0, openPnl: 10, closedPnl: 0, totalPnlNow: 10 };
    assert.deepEqual(trackerIssues({ trades: [trade], summary }), []);
    assert.ok(trackerIssues({ trades: [{ ...trade, finalGain: 99 }], summary }).some(issue => issue.includes('finalGain')));
    assert.ok(trackerIssues({ trades: [{ ...trade, entryDate: '2026-02-30' }], summary }).some(issue => issue.includes('invalid entryDate')));
    assert.ok(trackerIssues({ trades: [trade], summary: { ...summary, totalPnlNow: 999 } }).some(issue => issue.includes('totalPnlNow')));
});

const buySource = fs.readFileSync(path.join(__dirname, 'buy_alert.js'), 'utf8');
const riskFunction = buySource.slice(buySource.indexOf('    function isBlackSwanClean(s) {'), buySource.indexOf('    function getTierOfFR(s) {'));

function botContext(newsData, overrides = {}) {
    return vm.createContext({ newsData, canonName: name => name, snapDate: '2026-10-13',
        now: new Date('2026-10-13T09:30:00Z'), getMytDate: calendar.getMytDate,
        ...corporateRisk, ...overrides });
}

test('Buy alert risk uses the snapshot day, accepts short dates and matches earnings categories', () => {
    const context = botContext({ DUFU: { announcements: [{ date: '13 Oct', category: 'Change in Financial Year End', title: 'Change in Financial Year End' }] } });
    vm.runInContext(riskFunction, context);
    assert.equal(vm.runInContext("isBlackSwanClean({name:'DUFU'})", context), true);
    context.newsData.DUFU = { entitlements: [{ exDate: '13 Oct', isDividend: true }] };
    assert.equal(vm.runInContext("isBlackSwanClean({name:'DUFU'})", context), false);
    context.newsData.DUFU = { announcements: [{ date: '13 Oct', category: 'Financial Results', title: 'Quarterly report' }] };
    assert.equal(vm.runInContext("isBlackSwanClean({name:'DUFU'})", context), false);
});

test('Hot Theme bot keeps an older OPEN entry ahead of a newer closed entry', () => {
    const code = buySource.slice(buySource.indexOf('    const htTrackMap = new Map();'), buySource.indexOf('    const frTrackedNames = new Set'));
    const context = vm.createContext({ canonName: name => name, htTrades: [
        { name: 'DUFU', entryDate: '2026-10-01', status: 'OPEN' },
        { name: 'DUFU', entryDate: '2026-10-10', status: 'CLOSED_SL' }
    ] });
    vm.runInContext(code, context);
    assert.equal(vm.runInContext("htTrackMap.get('DUFU').status", context), 'OPEN');
});

test('Buy alert refresh retains failed-source news and removes newly discovered corporate traps', async () => {
    const enrich = buySource.slice(buySource.indexOf('    async function enrichListWithNews(list) {'), buySource.indexOf('    await enrichListWithNews(frOut);'));
    const filter = buySource.slice(buySource.indexOf('    for (const list of [frOut, htOut]) {'), buySource.indexOf("    console.log('✅ Semakan Berita"));
    const cachedEarnings = { date: '2026-10-13', category: 'Financial Results', title: 'Quarterly report' };
    const context = botContext({ DUFU: { announcements: [cachedEarnings], entitlements: [] } }, {
        symbolMap: { DUFU: '7233.KL' },
        getCorporateNewsRisk: async () => ({ announcements: [], entitlements: [], fetchStatus: { announcements: 'error', entitlements: 'ok' } }),
        frOut: [{ name: 'DUFU', code: '7233' }], htOut: []
    });
    vm.runInContext(riskFunction + enrich, context);
    await vm.runInContext('enrichListWithNews(frOut)', context);
    assert.equal(context.frOut[0].newsBadges[0].type, 'EARNINGS_QR');
    vm.runInContext(filter, context);
    assert.equal(context.frOut.length, 0);

    context.newsData.DUFU = { announcements: [], entitlements: [] };
    context.frOut.push({ name: 'DUFU', code: '7233' });
    context.getCorporateNewsRisk = async () => ({ announcements: [], entitlements: [{ isDividend: true, exDate: '2026-10-14', type: 'Dividend' }], fetchStatus: { announcements: 'ok', entitlements: 'ok' } });
    await vm.runInContext('enrichListWithNews(frOut)', context);
    vm.runInContext(filter, context);
    assert.equal(context.frOut.length, 0);
});

test('Scheduled buy alerts require delivery credentials while CLI dry runs remain available', () => {
    const gate = buySource.slice(buySource.indexOf("    if (process.env.BUY_ALERT_REQUIRE_DELIVERY === 'true'"), buySource.indexOf('    // 1. Load live_data.json'));
    const context = vm.createContext({ process: { env: { BUY_ALERT_REQUIRE_DELIVERY: 'true' } } });
    assert.throws(() => vm.runInContext(gate, context), /credentials are required/);
    delete context.process.env.BUY_ALERT_REQUIRE_DELIVERY;
    assert.doesNotThrow(() => vm.runInContext(gate, context));
});

test('Buy alert Telegram failures propagate so scheduled delivery can retry', async () => {
    const delivery = buySource.slice(buySource.indexOf('    const token = process.env.TELEGRAM_BOT_TOKEN;'), buySource.indexOf('})().catch(e => {'));
    let sent = 0;
    const context = vm.createContext({
        now: new Date('2026-10-13T09:30:00Z'), msg: 'Test alert',
        process: { env: { TELEGRAM_BOT_TOKEN: 'fixture', TELEGRAM_CHAT_ID: 'fixture' } },
        isTradingDay: calendar.isTradingDay, console: { log() {}, warn() {} }, setTimeout,
        sendTelegram: async () => { sent++; throw new Error('Token-bearing provider error must stay private'); }
    });
    await assert.rejects(vm.runInContext(`(async () => { ${delivery} })()`, context), /delivery failed; this alert remains pending/);
    assert.equal(sent, 1);
    context.sendTelegram = async () => { sent++; return { ok: true }; };
    await vm.runInContext(`(async () => { ${delivery} })()`, context);
    assert.equal(sent, 2);
});

test('Daily equity deltas exclude entry-day moves and reconcile independent entries and exits', () => {
    const days = [
        { date: '2026-10-12', price: 1, change: 0.2 },
        { date: '2026-10-13', price: 1.1, change: 0.1 },
        { date: '2026-10-14', price: 1.08, change: -0.02 }
    ];
    const history = Object.fromEntries(days.map(day => [`data_${day.date}.json`, JSON.stringify({ topVolume: [
        { name: 'DUFU', price: day.price, change: day.change },
        ...Array.from({ length: 51 }, (_, i) => ({ name: `FILLER${i}`, price: 1 }))
    ] })]));
    const trades = {
        FRESH_RIDER_TRACKER: { trades: [{ name: 'DUFU', entryType: '🔥 NEW', entryDate: '2026-10-12', entry: 1,
            currentPrice: 1.1, status: 'CLOSED_SL', exitDate: '2026-10-13', exitPrice: 1.04, finalGain: 4 }] },
        ADD_ON_TRACKER: { trades: [{ id: 'DUFU_2026-10-13_ADDON', name: 'DUFU', entryType: '⭐ ADD-ON A+',
            entryDate: '2026-10-13', entry: 1.1, currentPrice: 1.08, status: 'OPEN', finalGain: -1.8 }] },
        HOT_THEME_TRACKER: { trades: [] }
    };
    let output;
    const context = { __dirname, console: { log() {} } };
    context.global = context;
    context.require = name => {
        if (name === 'path') return path;
        if (name === './lib/bursa_calendar') return calendar;
        if (name === 'fs') return {
            readdirSync: () => Object.keys(history), statSync: () => ({ size: 100001 }), existsSync: () => false,
            readFileSync: filename => history[path.basename(filename)], writeFileSync: (filename, source) => { output = source; }
        };
        if (name.endsWith('fresh_rider_tracker.js')) Object.assign(context.window, trades);
        else if (name.endsWith('hot_theme_tracker.js')) context.window.HOT_THEME_TRACKER = trades.HOT_THEME_TRACKER;
        else throw new Error(name);
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'generate_daily_equity_tracker.js'), 'utf8'), context);
    const result = { window: {} };
    vm.runInNewContext(output, result);
    const timeline = result.window.DAILY_EQUITY_TRACKER.timeline;
    assert.equal(timeline[0].dailyPnlDelta, 0);
    assert.equal(timeline[1].totalPnl, 4);
    assert.equal(timeline[1].dailyPnlDelta, 4);
    assert.equal(timeline[2].dailyPnlDelta, -1.8);
    for (let i = 1; i < timeline.length; i++) {
        assert.equal(timeline[i].dailyPnlDelta, +(timeline[i].totalPnl - timeline[i - 1].totalPnl).toFixed(1));
    }
    assert.equal(new Set(timeline[1].trades.map(t => t.id)).size, 2);
    assert.equal(timeline[2].trades.find(t => t.statusOnDay === 'CLOSED').priceOnDay, 1.04);
});

function runScannerAudit(transformHtml = html => html) {
    let exitCode;
    const context = vm.createContext({ __dirname, console: { log() {}, error() {} }, process: { exit: code => { exitCode = code; } },
        require(name) {
            if (name === 'fs') return { ...fs, readFileSync(filename, ...args) {
                const source = fs.readFileSync(filename, ...args);
                return path.basename(filename) === 'index.html' ? transformHtml(source) : source;
            } };
            if (name === 'path') return path;
            if (name === 'vm') return vm;
            if (name === './lib/tracker_audit') return { trackerIssues };
            if (name === './lib/dashboard_state') return require('./lib/dashboard_state');
            if (name === './lib/strategy_rules') return StrategyRules;
            if (name === './lib/corporate_risk') return corporateRisk;
            if (name === './lib/bursa_calendar') return calendar;
            throw new Error(name);
        } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'verify_scanner_tracker_sync.js'), 'utf8'), context, { timeout: 10000 });
    return { exitCode, context };
}

test('Scanner audit evaluates regenerated assets against current-day dashboard rules', () => {
    const { exitCode, context } = runScannerAudit();
    assert.equal(exitCode, 0);
    assert.equal(vm.runInContext('snapshotDate', context), calendar.getMytDate(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'live_data.json'), 'utf8')).lastUpdated));
    assert.equal(vm.runInContext('tradesOnLatestDate.every(t => t.entryDate === snapshotDate)', context), true);
});

test('Scanner audit fails if the actual earnings or candle filter is disabled', () => {
    const earningsDisabled = runScannerAudit(html => html.replace('if (CorporateRisk.isEarningsAnnouncement(ann)) {', 'if (false) {'));
    assert.equal(earningsDisabled.exitCode, 1);
    const candlesDisabled = runScannerAudit(html => {
        const start = html.indexOf('        function isGreenCandle(item) {');
        const end = html.indexOf('        function escapeHtml', start);
        assert.ok(start > 0 && end > start);
        return html.slice(0, start) + '        function isGreenCandle(item) { return true; }\n' + html.slice(end);
    });
    assert.equal(candlesDisabled.exitCode, 1);
});
