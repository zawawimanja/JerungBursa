const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const CorporateRisk = require('./lib/corporate_risk');
const StrategyRules = require('./lib/strategy_rules');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function context(news = {}) {
    const ctx = vm.createContext({ CorporateRisk, StrategyRules, window: { NEWS_DATA: news },
        document: { getElementById: () => ({ value: '' }) } });
    const start = html.indexOf('        function getDashboardDate()');
    const end = html.indexOf('        window.getBlackSwanEvaluation', start);
    assert.ok(start > 0 && end > start);
    vm.runInContext(html.slice(start, end), ctx);
    return ctx;
}

test('Missing percent changes cannot turn red or unknown candles green', () => {
    const ctx = context();
    for (const [item, expected] of [
        [{ change: -0.01 }, false], [{}, false], [{ changePct: NaN, change: -0.01 }, false],
        [{ changePct: -1, change: 0.01 }, false], [{ changePct: 0 }, true], [{ change: 0.01 }, true]
    ]) assert.equal(ctx.isGreenCandle(item), expected, JSON.stringify(item));
    assert.ok(!html.includes('(item.change >= 0 || (item.changePct || 0) >= 0)'));
});

test('Dashboard uses Malaysia calendar labels after local midnight', () => {
    const ctx = context();
    vm.runInContext("Date.now = () => Date.parse('2026-10-12T16:30:00Z')", ctx);
    assert.equal(ctx.getDashboardDate(), '2026-10-13');
});

test('Year-end ex-dividend dates match backend calendar parsing', () => {
    const ctx = context({ EXAMPLE: { entitlements: [{ isDividend: true, exDate: '02 Jan' }] } });
    assert.equal(ctx.getBlackSwanEvaluation('EXAMPLE', {}, '2026-12-28').status, 'ex_div');
});

test('Financial year-end notices cannot hide candidates as quarterly earnings risk', () => {
    const ctx = context({ EXAMPLE: { announcements: [{ category: 'Change in Financial Year End',
        title: 'Change in Financial Year End', date: '2026-10-13' }] } });
    assert.equal(ctx.getBlackSwanEvaluation('EXAMPLE', {}, '2026-10-13').status, 'pass');
    ctx.window.NEWS_DATA.EXAMPLE.announcements[0] = { category: 'Financial Results',
        title: 'Quarterly report', date: '2026-10-13' };
    assert.equal(ctx.getBlackSwanEvaluation('EXAMPLE', {}, '2026-10-13').status, 'qr_risk');
});

test('Announcement quotes and markup stay text inside the risk tooltip', () => {
    const title = 'Quarterly report \" /><img src=x onerror=alert(1)>';
    const ctx = context({ EXAMPLE: { announcements: [{ category: 'Financial Results', title, date: '2026-10-13' }] } });
    const result = ctx.getBlackSwanEvaluation('EXAMPLE', {}, '2026-10-13');
    assert.equal(result.status, 'qr_risk');
    assert.ok(!result.badgeHtml.includes('<img'));
    assert.ok(result.badgeHtml.includes('&quot;'));
    assert.ok(result.badgeHtml.includes('&lt;img'));
});

test('Actual dashboard Top Ranking honors the shared 5% ADD-ON floor limit', () => {
    const start = html.indexOf("            } else if (filterMode === 'top_ranking') {", html.indexOf('function renderConfluenceRadar'));
    const filterStart = html.indexOf('displayPicks = picks.filter', start);
    const filterEnd = html.indexOf('});', filterStart) + 3;
    assert.ok(start > 0 && filterEnd > filterStart);
    const ctx = vm.createContext({ StrategyRules, picks: [{ name: 'EXAMPLE',price:1.049,turnover:3000000,closeTightness:3 }], displayPicks: [], effFloorOf:() => 1,
        frTrackMap: new Map(), frFreshness: () => 2,
        getTierOfFR: () => ({ fDistVal: 4.9, tightValNum: 3, toVal: 3000000, isBlackSwanClean: true }) });
    vm.runInContext(html.slice(filterStart, filterEnd), ctx);
    assert.equal(ctx.displayPicks.length, 1);
    ctx.getTierOfFR = () => ({ fDistVal: 5.01, tightValNum: 3, toVal: 3000000, isBlackSwanClean: true });
    ctx.picks[0].price = 1.0501;
    vm.runInContext(html.slice(filterStart, filterEnd), ctx);
    assert.equal(ctx.displayPicks.length, 0);
});
