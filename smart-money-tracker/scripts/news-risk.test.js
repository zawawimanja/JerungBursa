const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const risk = require('./fetch_news_module');
const { generateNewsData, rebuildNewsCache, collectCandidates } = require('./generate_news_data');
const { parseDataScript } = require('../live-refresh');

const reference = '2026-10-13T09:00:00Z';
const dividend = exDate => ({ type: 'Interim Dividend', exDate, amount: '0.5 sen', isDividend: true });
const earnings = date => ({ date, category: 'Financial Results', title: 'Quarterly rpt on consolidated results' });
const logger = { log() {}, warn() {} };

test('Event dates validate the full calendar date and handle Malaysia midnight and year boundaries', () => {
    assert.equal(risk.parseEventDate('01 Jan', '2026-12-30').toISOString().slice(0, 10), '2027-01-01');
    assert.equal(risk.parseEventDate('31 Dec', '2027-01-02').toISOString().slice(0, 10), '2026-12-31');
    assert.equal(risk.parseEventDate('01 Jan', '2026-12-30', { pastOnly: true }).toISOString().slice(0, 10), '2026-01-01');
    assert.equal(risk.parseEventDate('01 Jan', '2026-12-31T16:05:00Z', { pastOnly: true }).toISOString().slice(0, 10), '2027-01-01');
    assert.equal(risk.parseEventDate('29 Feb 2024', reference).toISOString().slice(0, 10), '2024-02-29');
    assert.equal(risk.parseEventDate('21-Jul-2026', reference).toISOString().slice(0, 10), '2026-07-21');
    assert.equal(risk.parseEventDate('1-September-2026', reference).toISOString().slice(0, 10), '2026-09-01');
    for (const date of ['31 Feb 2026', '29 Feb 2026', '2026-13-01', '2026-04-31', '13 Octopus', '13 FOO', '', '1,500,000', '2026-01-00']) {
        assert.equal(risk.parseEventDate(date, reference), null, date);
    }
    assert.equal(risk.parseEventDate('13 Oct', 'invalid'), null);
});

test('Provider dates that span several years retain descending chronology', () => {
    const normalized = risk.normalizeAnnouncements(['05 Oct', '15 Nov', '20 Oct', '11 Jan', '22 Dec'].map(earnings), reference, { descending: true });
    assert.deepEqual(normalized.map(a => a.date), ['2026-10-05', '2025-11-15', '2025-10-20', '2025-01-11', '2024-12-22']);
});

test('Browser and backend share the same pure date and earnings classification helpers', () => {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'lib', 'corporate_risk.js'), 'utf8'), context);
    const browser = context.window.CorporateRisk;
    assert.equal(browser.parseEventDate('01 Jan', '2026-12-30').toISOString(), risk.parseEventDate('01 Jan', '2026-12-30').toISOString());
    assert.equal(browser.isEarningsAnnouncement(earnings('2026-10-13')), true);
    assert.equal(browser.isEarningsAnnouncement({ title: 'Change in Financial Year End', category: 'Financial Results' }), false);
});

test('Risk badges expire without deleting historical events needed by tracker replay', () => {
    const announcements = [earnings('18 Aug'), earnings('10 Oct'), { date: '11 Oct', category: 'Financial Results', title: 'Change in Financial Year End' }];
    const result = risk.buildCorporateNewsRisk(announcements, [], reference);
    assert.equal(result.hasNewsAlert, true);
    assert.equal(result.newsBadges.filter(b => b.type === 'EARNINGS_QR').length, 1);
    assert.match(result.newsBadges.find(b => b.type === 'EARNINGS_QR').title, /2026-10-10/);
    assert.equal(result.announcements.length, 3);
    assert.equal(result.announcements[0].date, '2026-08-18');
    const expired = risk.buildCorporateNewsRisk([earnings('2026-08-18')], [], reference);
    assert.equal(expired.hasNewsAlert, false);
    assert.deepEqual(expired.newsBadges, []);
    assert.equal(risk.buildCorporateNewsRisk([earnings('2026-10-05')], [], reference).hasNewsAlert, false);
    assert.equal(risk.buildCorporateNewsRisk([earnings('2026-10-06')], [], reference).hasNewsAlert, true);
    assert.equal(risk.buildCorporateNewsRisk([earnings('2026-10-23')], [], reference).hasNewsAlert, true);
    assert.equal(risk.buildCorporateNewsRisk([earnings('2026-10-24')], [], reference).hasNewsAlert, false);
});

test('All dividends are checked, with expired rows and invalid dates ignored', () => {
    const result = risk.buildCorporateNewsRisk([], [dividend('01 Sep 2026'), dividend('20 Oct 2026'), dividend('1,500,000')], reference);
    assert.equal(result.hasNewsAlert, true);
    assert.match(result.newsBadges[0].title, /20 Oct 2026/);
    assert.equal(risk.buildCorporateNewsRisk([], [dividend('08 Oct 2026')], reference).hasNewsAlert, true);
    assert.equal(risk.buildCorporateNewsRisk([], [dividend('07 Oct 2026')], reference).hasNewsAlert, false);
    assert.equal(risk.buildCorporateNewsRisk([], [dividend('12 Nov 2026')], reference).hasNewsAlert, true);
    assert.equal(risk.buildCorporateNewsRisk([], [dividend('13 Nov 2026')], reference).hasNewsAlert, false);
});

test('Announcement parsing handles additional classes, nested text, entities and year labels', () => {
    const html = `<a class="announcement-item highlighted"><span class="day">31</span><span class="month">Dec</span><span class="year">2025</span><span class="category-tag financial">Financial Results</span><div class="title">Quarterly <b>report</b> &amp; earnings</div></a>`;
    assert.deepEqual(risk.parseAnnouncements(html, '2026-01-02'), [{ date: '2025-12-31', category: 'Financial Results', title: 'Quarterly report & earnings' }]);
    const yearless = html.replace('<span class="year">2025</span>', '');
    assert.equal(risk.parseAnnouncements(yearless, '2026-01-02')[0].date, '2025-12-31');
    const oldFormat = '<table><tr><td>13 Oct 2026</td><td>General Announcement</td><td>Letter of Award</td></tr></table>';
    assert.equal(risk.parseAnnouncements(oldFormat, reference)[0].date, '2026-10-13');
    assert.deepEqual(risk.parseAnnouncements('<p>No announcements found</p>', reference), []);
    assert.throws(() => risk.parseAnnouncements('', reference), /Empty/);
    assert.throws(() => risk.parseAnnouncements('<html>Access denied</html>', reference), /Unrecognized/);
    assert.throws(() => risk.parseAnnouncements('<a class="announcement-item"><span class="day">31</span><span class="month">Feb</span><span class="year">2026</span><div class="title">Quarterly report</div></a>', reference), /Invalid announcement date/);
});

test('Dividends parsing stays inside the dividend table and rejects provider layout failures', () => {
    const html = `<div id="dividends"><table><tr><th>Ann. Date</th><th>Financial Year</th><th>Type</th><th>Ex-Date</th></tr><tr><td>01 Oct 2026</td><td>2026</td><td>Interim Dividend</td><td>20 Oct 2026</td><td>05 Nov 2026</td><td>0.5 sen</td></tr></table></div><div id="shareholders"><table><tr><td>01 Oct 2026</td><td>30 Sep 2026</td><td>Acquired</td><td>1,500,000</td><td>A person</td></tr></table></div>`;
    const parsed = risk.parseEntitlements(html, reference);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].exDate, '2026-10-20');
    assert.equal(parsed[0].isDividend, true);
    assert.deepEqual(risk.parseEntitlements('<div id="dividends"><table><tr><th>Ex-Date</th></tr></table></div>', reference), []);
    assert.throws(() => risk.parseEntitlements('<html>Access denied</html>', reference), /section is missing/);
    assert.throws(() => risk.parseEntitlements('<div id="dividends"></div>', reference), /table is missing/);
});

test('HTTP errors, malformed JSON and unexpected pages are marked as unavailable feeds', async () => {
    for (const response of [{ status: 503, data: '' }, { status: 200, data: '{broken' }, { status: 200, data: '{}' }, { status: 200, data: '{"html":""}' }]) {
        const result = await risk.getCorporateNewsRisk('0001', 'EXAMPLE', { reference, fetchImpl: async () => response });
        assert.deepEqual(result.fetchStatus, { announcements: 'error', entitlements: 'error' });
    }
    const partial = await risk.getCorporateNewsRisk('0001', 'EXAMPLE', { reference, fetchImpl: async url => url.includes('/announcements/') ? { status: 503, data: '' } : { status: 200, data: '<div id="dividends"><table><tr><td>01 Oct 2026</td><td>2026</td><td>Dividend</td><td>20 Oct 2026</td></tr></table></div>' } });
    assert.deepEqual(partial.fetchStatus, { announcements: 'error', entitlements: 'ok' });
    assert.equal(partial.hasNewsAlert, true);
});

test('A response that keeps delivering chunks still stops at the absolute fetch deadline', async () => {
    let destroyed = false;
    const result = await risk.fetchUrl('https://example.invalid', { timeoutMs: 20, requestImpl: (_url, _options, onResponse) => {
        const response = new EventEmitter();
        response.statusCode = 200;
        response.setEncoding = () => {};
        onResponse(response);
        const drip = setInterval(() => response.emit('data', 'x'), 2);
        const request = new EventEmitter();
        request.destroy = () => { destroyed = true; clearInterval(drip); response.emit('aborted'); };
        return request;
    } });
    assert.equal(result.status, 408);
    assert.equal(destroyed, true);
});

function fixture(t, previous = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jerung-news-risk-'));
    t.after(() => {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('jerung-news-risk-'));
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(directory).startsWith('jerung-news-risk-'));
        fs.rmSync(directory, { recursive: true });
    });
    fs.writeFileSync(path.join(directory, 'live_data.json'), JSON.stringify({ topVolume: [{ name: 'EXAMPLE', code: '0001' }], topGainers: [{ name: 'EXAMPLE' }] }));
    fs.writeFileSync(path.join(directory, 'news_data.js'), `// Generated At: 2026-10-12T09:00:00Z\nwindow.NEWS_DATA = ${JSON.stringify(previous)};`);
    return directory;
}

test('A failed refresh preserves cached risks per feed; confirmed empty results can clear old risks', async t => {
    const previous = risk.buildCorporateNewsRisk([earnings('2026-10-10')], [dividend('20 Oct 2026')], reference);
    const dataDir = fixture(t, { EXAMPLE: previous });
    let calledCode;
    const failed = await generateNewsData({ dataDir, reference, logger, fetchRisk: async code => { calledCode = code; throw new Error('Offline'); } });
    assert.equal(calledCode, '0001');
    assert.equal(failed.EXAMPLE.hasNewsAlert, true);
    assert.equal(failed.EXAMPLE.announcements.length, 1);
    assert.equal(failed.EXAMPLE.entitlements.length, 1);
    assert.equal(failed.EXAMPLE.lastSuccessfulAt.announcements, '2026-10-12T09:00:00.000Z');
    const partial = await generateNewsData({ dataDir, reference, logger, fetchRisk: async () => ({ announcements: [], entitlements: [], fetchStatus: { announcements: 'ok', entitlements: 'error' } }) });
    assert.equal(partial.EXAMPLE.hasNewsAlert, true);
    assert.equal(partial.EXAMPLE.announcements.length, 0);
    assert.equal(partial.EXAMPLE.entitlements.length, 1);
    const empty = await generateNewsData({ dataDir, reference, logger, fetchRisk: async () => ({ announcements: [], entitlements: [], fetchStatus: { announcements: 'ok', entitlements: 'ok' } }) });
    assert.equal(empty.EXAMPLE, undefined);
    assert.deepEqual(parseDataScript(fs.readFileSync(path.join(dataDir, 'news_data.js'), 'utf8'), ['NEWS_DATA']).NEWS_DATA, {});
});

test('Offline cache rebuild anchors missing years to source time and keeps original source freshness', async t => {
    const cache = { EXAMPLE: { announcements: [earnings('31 Dec')], entitlements: [dividend('1,500,000'), dividend('05 Jan 2027')], hasNewsAlert: true, newsBadges: [] } };
    const normalized = rebuildNewsCache(cache, '2027-02-01', '2027-01-02T09:00:00Z');
    assert.equal(normalized.EXAMPLE.announcements[0].date, '2026-12-31');
    assert.equal(normalized.EXAMPLE.entitlements.length, 1);
    assert.equal(normalized.EXAMPLE.hasNewsAlert, false);
    assert.equal(normalized.EXAMPLE.lastSuccessfulAt.announcements, '2027-01-02T09:00:00.000Z');
    const dataDir = fixture(t, cache);
    fs.writeFileSync(path.join(dataDir, 'news_data.js'), `// Generated At: 2027-01-02T09:00:00Z\nwindow.NEWS_DATA = ${JSON.stringify(cache)};`);
    const output = await generateNewsData({ dataDir, reference: '2027-02-01', logger, cachedOnly: true, fetchRisk: async () => { throw new Error('Cache-only mode must never fetch'); } });
    assert.equal(output.EXAMPLE.announcements[0].date, '2026-12-31');
    assert.equal(output.EXAMPLE.lastSuccessfulAt.announcements, '2027-01-02T09:00:00.000Z');
    const unavailable = rebuildNewsCache({ MISSING: { announcements: [], entitlements: [], checkedAt: '2027-01-03T09:00:00Z', fetchStatus: { announcements: 'error', entitlements: 'error' }, lastSuccessfulAt: { announcements: null, entitlements: null } } }, '2027-02-01', '2027-01-02T09:00:00Z');
    assert.deepEqual(unavailable.MISSING.lastSuccessfulAt, { announcements: null, entitlements: null });
    assert.equal(unavailable.MISSING.checkedAt, '2027-01-03T09:00:00Z');
});

test('Candidate collection retains a known code when another source omits it and includes all tracker variants', t => {
    const dataDir = fixture(t);
    const tracker = { FRESH_RIDER_TRACKER: { entries: [{ name: 'FR', code: '0002' }] }, ADD_ON_TRACKER: {}, FLOOR_ADDON_TRACKER: {}, ALL_TRACKER: { entries: [{ name: 'ADDON', code: '0003' }] } };
    fs.writeFileSync(path.join(dataDir, 'fresh_rider_tracker.js'), Object.entries(tracker).map(([key, value]) => `window.${key} = ${JSON.stringify(value)};`).join('\n'));
    const candidates = collectCandidates({ topVolume: [{ name: 'EXAMPLE', code: '0001' }], topGainers: [{ name: 'EXAMPLE' }] }, dataDir);
    assert.equal(candidates.find(s => s.name === 'EXAMPLE').code, '0001');
    assert.equal(candidates.find(s => s.name === 'ADDON').code, '0003');
});
