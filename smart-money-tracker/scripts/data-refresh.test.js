const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const live = require('../live-refresh');
const { getMytDate, upsertTradingDay } = require('./lib/bursa_calendar');
const { trackerIssues } = require('./lib/tracker_audit');
const { getMytTime } = require('./run_live_updater');

const now = Date.parse('2026-10-13T08:00:00Z');
const snapshot = timestamp => ({ lastUpdated: timestamp, topVolume: [{ name: 'EXAMPLE', price: 1 }] });
const response = data => ({ ok: true, text: async () => JSON.stringify(data) });

test('Newest valid snapshot wins even after market close and older responses never roll back data', async () => {
    const fetchImpl = async url => response(snapshot(url.startsWith(live.GITHUB_BASE) ? '2026-10-13T07:55:00Z' : '2026-10-13T07:50:00Z'));
    const selected = await live.loadSnapshot({ fetchImpl, now });
    assert.equal(selected.base, live.GITHUB_BASE);
    const newer = snapshot('2026-10-13T07:59:00Z');
    assert.equal((await live.loadSnapshot({ fetchImpl, now, previous: newer })).raw, newer);
});

test('HTTP failure and malformed or empty snapshots fall back without losing the saved snapshot', async () => {
    const selected = await live.loadSnapshot({ now, fetchImpl: async url => {
        if (!url.startsWith(live.GITHUB_BASE)) return { ok: false, status: 503 };
        return response(snapshot('2026-10-13T07:55:00Z'));
    } });
    assert.equal(selected.base, live.GITHUB_BASE);
    const previous = snapshot('2026-10-13T07:50:00Z');
    const offline = await live.loadSnapshot({ now, previous, fetchImpl: async () => response({ lastUpdated: 'not a date', topVolume: [] }) });
    assert.equal(offline.raw, previous);
    assert.equal(offline.checked, false);
    await assert.rejects(live.loadSnapshot({ now, fetchImpl: async () => response({}) }));
});

test('Hung data requests have a deadline', async () => {
    await assert.rejects(live.request('/stalled', () => new Promise(() => {}), 10), /timed out/);
});

test('All real generated assets decode as JSON; downloaded code is rejected', () => {
    for (const [file, keys] of Object.entries(live.DATA_FILES)) {
        const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        const decoded = live.parseDataScript(source, keys);
        const context = { window: {} };
        vm.runInNewContext(source, context);
        assert.equal(JSON.stringify(decoded), JSON.stringify(context.window), file);
    }
    const payload = { text: '}; window.OTHER = "x"; path \\ test' };
    assert.deepEqual(live.parseDataScript('window.DATA = ' + JSON.stringify(payload) + ';', ['DATA']), { DATA: payload });
    assert.throws(() => live.parseDataScript('window.DATA = {}; alert("bad");', ['DATA']));
    assert.throws(() => live.parseDataScript('window.DATA = {};', ['DATA', 'MISSING']));
});

test('Bundle refresh loads every tracker variant from the selected source and fails atomically', async () => {
    const fetchImpl = async url => ({ ok: true, text: async () => {
        const file = url.split('/').pop().split('?')[0];
        return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    } });
    const bundle = await live.loadBundle(live.GITHUB_BASE, fetchImpl, now);
    assert.ok(bundle.ALL_TRACKER && bundle.HOT_THEME_TRACKER && bundle.DAILY_EQUITY_TRACKER && bundle.NEWS_DATA);
    await assert.rejects(live.loadBundle(live.GITHUB_BASE, async url => url.includes('hot_theme_tracker') ? { ok: false, status: 503 } : fetchImpl(url), now));
});

test('Malaysia midnight, same-day corrections and older snapshots preserve trading-day order', () => {
    assert.equal(getMytDate('2026-10-12T16:51:05Z'), '2026-10-13');
    assert.equal(getMytDate('2026-10-12T15:59:59Z'), '2026-10-12');
    assert.equal(getMytDate('invalid'), '');
    const days = [{ date: '2026-10-13', rows: ['old'] }];
    upsertTradingDay(days, { date: '2026-10-13', rows: ['new'] });
    upsertTradingDay(days, { date: '2026-10-12', rows: [] });
    assert.deepEqual(days.map(day => day.date), ['2026-10-12', '2026-10-13']);
    assert.deepEqual(days[1].rows, ['new']);
    assert.deepEqual(getMytTime(new Date('2026-10-12T16:51:05Z')), { hour: 0, min: 51, dateStr: '2026-10-13' });
});

test('Delayed status covers settlement and checking never changes snapshot timestamps', () => {
    assert.equal(live.freshness('2026-10-13T01:00:00Z', now).delayed, true);
    assert.equal(live.freshness('2026-10-13T07:55:00Z', now).delayed, false);
    assert.equal(live.freshness('2026-10-13T09:00:00Z', Date.parse('2026-10-13T09:55:00Z')).delayed, true);
    assert.equal(live.freshness('2026-10-13T09:00:00Z', Date.parse('2026-10-13T12:00:00Z')).delayed, false);
});

test('Audit accepts legitimate exits and zero OPEN positions but rejects corrupt records and summaries', () => {
    const trade = { name: 'GREATEC', entryType: 'NEW', entryDate: '2026-10-01', lastDate: '2026-10-13', highDate: '2026-10-02', entry: 1, currentPrice: 1.1, high: 1.2, finalGain: 10, status: 'CLOSED_SL', exitDate: '2026-10-13', exitPrice: 1.1 };
    const tracker = { trades: [trade], summary: { totalTracked: 1, openCount: 0, closedCount: 1 } };
    assert.deepEqual(trackerIssues(tracker), []);
    assert.ok(trackerIssues({ ...tracker, trades: [{ ...trade, exitPrice: null }] }).length);
    assert.ok(trackerIssues({ ...tracker, summary: { ...tracker.summary, openCount: 1 } }).length);
    assert.ok(trackerIssues({ ...tracker, trades: [{ ...trade, lastDate: '2026-09-01' }] }).length);
    assert.ok(trackerIssues({ ...tracker, trades: [{ ...trade, status: 'OPEN' }] }).length);
});

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
test('All dashboard inline scripts compile', () => {
    let count = 0;
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        new vm.Script(match[1]);
        count++;
    }
    assert.ok(count > 0);
});

function dashboardContext(overrides = {}) {
    const nodes = {};
    const renders = [];
    const context = {
        window: { location: { protocol: 'file:' }, liveData: snapshot('2026-10-13T07:00:00Z'), _lastSelfHealTrigger: 0 },
        document: { getElementById: id => nodes[id] ||= { style: {}, value: '', textContent: '' } },
        JerungLive: { ...live, ...overrides },
        console: { warn() {} },
        applyFilters: () => renders.push('scanner'),
        renderFreshRiderTracker: () => renders.push('fr'),
        renderHotThemeTracker: () => renders.push('ht'),
        updateTopTrackerPnlBadge: () => renders.push('pnl')
    };
    vm.createContext(context);
    vm.runInContext(`let currentData = [], _viewingArchive = false, _autoRefreshBusy = false,
        _liveRefreshPromise = null, _dataViewRevision = 0, _liveSourceBase = '', _lastBundleVersion = '',
        _lastDataCheck = 0, _refreshIssue = '', _selfHealStatus = '',
        _recentFloorCache = {}, _freshRiderPrevCache = {}, _hotThemePrevCache = {};`, context);
    const start = html.indexOf('        function updateLiveStatus()');
    const end = html.indexOf('        function passesGlobalFilters', start);
    vm.runInContext(html.slice(start, end), context);
    return { context, nodes, renders };
}

test('Dashboard refresh updates prices, trackers, badges and caches while retaining the real data timestamp', async () => {
    const raw = { ...snapshot('2026-10-13T07:59:00Z'), topGainers: [{ name: 'EXAMPLE', price: 1 }, { name: 'SECOND', price: 2 }] };
    const bundle = { ALL_TRACKER: { marker: 'new' }, HOT_THEME_TRACKER: { marker: 'new' } };
    const { context, nodes, renders } = dashboardContext({ loadSnapshot: async () => ({ raw, base: 'source/', checked: true }), loadBundle: async () => bundle });
    await context.fetchLiveData();
    assert.equal(context.window.liveData.lastUpdated, raw.lastUpdated);
    assert.equal(context.window.ALL_TRACKER, bundle.ALL_TRACKER);
    assert.equal(vm.runInContext('currentData.length', context), 2);
    assert.equal(vm.runInContext('_recentFloorCache', context), null);
    assert.deepEqual(renders, ['scanner', 'fr', 'ht', 'pnl']);
    assert.match(nodes.dashboardSubtitle.textContent, /Last checked:.*Auto-check: 5 min/);
    assert.equal(vm.runInContext('_autoRefreshBusy', context), false);
});

test('Archive selection during a live request cannot be overwritten by its late response', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const { context, renders } = dashboardContext({ loadSnapshot: () => pending, loadBundle: async () => ({ ALL_TRACKER: {} }) });
    const old = context.window.liveData;
    const refresh = context.fetchLiveData();
    vm.runInContext('_dataViewRevision++; _viewingArchive = true; currentData = [{name: "ARCHIVE"}];', context);
    release({ raw: snapshot('2026-10-13T07:59:00Z'), base: 'source/', checked: true });
    await refresh;
    assert.equal(context.window.liveData, old);
    assert.equal(vm.runInContext('currentData[0].name', context), 'ARCHIVE');
    assert.deepEqual(renders, []);
});

test('Partial bundle failure keeps previous trackers and retries on the next check', async () => {
    let attempts = 0;
    const { context, nodes } = dashboardContext({
        loadSnapshot: async () => ({ raw: snapshot('2026-10-13T07:59:00Z'), base: 'source/', checked: true }),
        loadBundle: async () => { if (++attempts === 1) throw new Error('offline'); return { ALL_TRACKER: { marker: 'updated' } }; }
    });
    context.window.ALL_TRACKER = { marker: 'old' };
    await context.fetchLiveData();
    assert.equal(context.window.ALL_TRACKER.marker, 'old');
    assert.match(nodes.dashboardSubtitle.textContent, /Tracker refresh pending/);
    await context.fetchLiveData();
    assert.equal(context.window.ALL_TRACKER.marker, 'updated');
    assert.doesNotMatch(nodes.dashboardSubtitle.textContent, /Tracker refresh pending/);
});
