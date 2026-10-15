/**
 * verify_scanner_tracker_sync.js
 * 
 * AUTOMATED AUDIT & SYNC VERIFICATION SYSTEM FOR JERUNGBURSA
 * -----------------------------------------------------------
 * Checks tracker structure, default Fresh Rider scanner rules and sampled guardrails across:
 * 1. Backend record and summary invariants (ALL_TRACKER & HOT_THEME_TRACKER)
 * 2. Actual default Fresh Rider candidate, floor, risk and Top Ranking rules
 * 3. Sampled Hot Theme source guards; related unit tests cover alert paths
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { trackerIssues } = require('./lib/tracker_audit');
const CorporateRisk = require('./lib/corporate_risk');
const StrategyRules = require('./lib/strategy_rules');
const DashboardState = require('./lib/dashboard_state');
const { getMytDate } = require('./lib/bursa_calendar');

const ROOT_DIR = path.resolve(__dirname, '..');

function loadJsInContext(filename) {
    const fullPath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(fullPath)) return {};
    const code = fs.readFileSync(fullPath, 'utf8');
    const ctx = {
        window: {},
        console: console,
        Map: Map,
        Set: Set,
        Array: Array,
        Object: Object,
        Math: Math,
        Date: Date,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        Boolean: Boolean,
        String: String
    };
    vm.createContext(ctx);
    try {
        vm.runInContext(code, ctx);
    } catch (e) {
        console.error(`[Error loading ${filename}]:`, e.message);
    }
    return ctx.window;
}

console.log('='.repeat(70));
console.log('🦈 JERUNGBURSA AUTOMATED SCANNER-TRACKER SYNC AUDIT');
console.log('='.repeat(70));

const liveWindow = loadJsInContext('live_data.js');
const frWindow = loadJsInContext('fresh_rider_tracker.js');
const htWindow = loadJsInContext('hot_theme_tracker.js');
const newsWindow = loadJsInContext('news_data.js');
const equityWindow = loadJsInContext('daily_equity_tracker.js');
const indexSrc = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passCount++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failCount++;
    }
}

// -------------------------------------------------------------
// TEST 1: Load integrity
// -------------------------------------------------------------
console.log('\n[1] Verifying Data File Integrity...');
const liveData = (liveWindow.liveData && liveWindow.liveData.topVolume) ? liveWindow.liveData.topVolume : [];
assert(liveData.length > 0, `live_data.js loaded successfully (${liveData.length} stocks in topVolume)`);

const allTracker = frWindow.ALL_TRACKER;
assert(allTracker && Array.isArray(allTracker.trades) && allTracker.trades.length > 0, 
    `fresh_rider_tracker.js has ALL_TRACKER with ${allTracker ? allTracker.trades.length : 0} trades`);

const htTracker = htWindow.HOT_THEME_TRACKER;
assert(htTracker && Array.isArray(htTracker.trades) && htTracker.trades.length > 0,
    `hot_theme_tracker.js has HOT_THEME_TRACKER with ${htTracker ? htTracker.trades.length : 0} trades`);
if (!allTracker || !Array.isArray(allTracker.trades) || !htTracker || !Array.isArray(htTracker.trades)) {
    process.exit(1);
}
const frIssues = trackerIssues(allTracker);
assert(frIssues.length === 0, `Fresh Rider trade records and summary are consistent (${frIssues.join('; ') || 'valid'})`);

// -------------------------------------------------------------
// TEST 2: Latest Entry Date & Active Positions
// -------------------------------------------------------------
console.log('\n[2] Checking Latest Entry Date & Active Signals...');
// Use OPEN trades only for latestDate — avoids highDate/lastDate contamination from closed trades.
const openTrades = allTracker.trades.filter(t => t.status === 'OPEN');
const sortedOpenDates = [...new Set(openTrades.map(t => t.entryDate).filter(Boolean))].sort();
const latestDate = sortedOpenDates[sortedOpenDates.length - 1];
console.log(`  📅 Latest recorded entry date in tracker (OPEN trades): ${latestDate}`);

const snapshotDate = getMytDate(liveWindow.liveData.lastUpdated);
assert(!!snapshotDate, 'Live snapshot has a valid Malaysia trading date');
const tradesOnLatestDate = openTrades.filter(t => t.entryDate === snapshotDate);
console.log(`  🎯 Active entries on snapshot day ${snapshotDate}: ${tradesOnLatestDate.map(t => `${t.name} (${t.entryType})`).join(', ') || 'none'}`);

if (!openTrades.length) console.log('  ℹ️ No OPEN Fresh Rider positions; closed positions remain valid.');

// -------------------------------------------------------------
// TEST 3: Scanner Top Ranking Simulation & Sync
// -------------------------------------------------------------
console.log('\n[3] Evaluating Saved Dashboard "Top Ranking VVIP" Rules on Live Data...');

// Evaluate the saved dashboard's actual functions rather than copied risk/floor rules.
// Global filter preferences are left at their unfiltered defaults for this audit.
function dashboardSection(startMarker, endMarker, from = 0) {
    const start = indexSrc.indexOf(startMarker, from);
    const end = indexSrc.indexOf(endMarker, start);
    if (start < 0 || end <= start) throw new Error('Dashboard audit section missing: ' + startMarker);
    return indexSrc.slice(start, end);
}
const renderStart = indexSrc.indexOf('        function renderConfluenceRadar()');
const frTrackMap = new Map();
for (const status of [false, true]) {
    allTracker.trades.filter(t => (t.status === 'OPEN') === status)
        .sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))
        .forEach(t => frTrackMap.set((t.name || '').toUpperCase(), t));
}
const scannerRules = vm.createContext({
    CorporateRisk, StrategyRules, DashboardState,
    window: { ...frWindow, ...newsWindow, ...equityWindow },
    document: { getElementById: () => ({ value: snapshotDate }) },
    curRefDate: snapshotDate, _recentFloorCache: null, _crPickedNames: new Set(),
    frTrackMap, list: liveData, picks: [], passesGlobalFilters: () => true
});
vm.runInContext(dashboardSection('        function getDashboardDate()', '        window.getBlackSwanEvaluation'), scannerRules);
vm.runInContext(dashboardSection('        function getRecentFloorMap(', '        // Global Filter Mode for Fresh Rider'), scannerRules);
vm.runInContext("const recentFloorMap = getRecentFloorMap('', 5);", scannerRules);
vm.runInContext(dashboardSection('            const effFloorOf = (item) => {', '            for (const item of list)', renderStart), scannerRules);
vm.runInContext(dashboardSection('            const frFreshness = (it) => {', '            // Klasifikasi Tier A+', renderStart), scannerRules);
vm.runInContext(dashboardSection('            const getTierOfFR = (it) => {', "            if (typeof updateHeaderSortIndicators", renderStart), scannerRules);
vm.runInContext('globalThis.auditTier = getTierOfFR; globalThis.auditFreshness = frFreshness; globalThis.auditFloor = effFloorOf;', scannerRules);
vm.runInContext(dashboardSection('            for (const item of list)', '            // Penalaan Ketepatan Tinggi:', renderStart), scannerRules);
const topFilterStart = indexSrc.indexOf("} else if (filterMode === 'top_ranking')", renderStart);
const filterStart = indexSrc.indexOf('                displayPicks = picks.filter(p => {', topFilterStart);
const filterEnd = indexSrc.indexOf('\n                });', filterStart);
if (topFilterStart < 0 || filterStart < 0 || filterEnd <= filterStart) throw new Error('Fresh Rider Top Ranking audit filter missing');
vm.runInContext(indexSrc.slice(filterStart, filterEnd + '\n                });'.length), scannerRules);
const getTierOfFR = scannerRules.auditTier;
const frFreshness = scannerRules.auditFreshness;
const effFloorOf = scannerRules.auditFloor;
const candidateMap = new Map(scannerRules.picks.map(item => [item.name.toUpperCase(), item]));
const topRankingPicks = scannerRules.displayPicks;

// These fixtures ensure risk checks were actually evaluated instead of stubbed as PASS.
const riskFixture = { name: '__AUDIT_RISK', price: 1, floorLow: 0.99, turnover: 3000000, closeTightness: 2, ipoYear: 2025, touchCount: 4 };
scannerRules.window.NEWS_DATA ||= {};
scannerRules.window.NEWS_DATA[riskFixture.name] = { entitlements: [{ isDividend: true, exDate: snapshotDate }] };
assert(getTierOfFR(riskFixture).isBlackSwanClean === false, 'Actual scanner rejects a same-day ex-dividend event');
scannerRules.window.NEWS_DATA[riskFixture.name] = { announcements: [{ category: 'Financial Results', title: 'Quarterly report', date: snapshotDate }] };
assert(getTierOfFR(riskFixture).isBlackSwanClean === false, 'Actual scanner rejects a same-day earnings release');
scannerRules.window.NEWS_DATA[riskFixture.name] = { announcements: [{ category: 'Change in Financial Year End', title: 'Change in Financial Year End', date: snapshotDate }] };
assert(getTierOfFR(riskFixture).isBlackSwanClean === true, 'Actual scanner permits a financial year-end notice');
assert(scannerRules.isGreenCandle({ change: -0.01 }) === false && scannerRules.isGreenCandle({}) === false,
    'Actual scanner does not turn red or unknown candles green');
assert(!!getTierOfFR({ ...riskFixture, hasUpperWickRejection: true, changePct: -2 }).isRealUpperWickDump,
    'Actual scanner identifies a red upper-wick rejection');
delete scannerRules.window.NEWS_DATA[riskFixture.name];

const topRankingNames = new Set(topRankingPicks.map(p => p.name.toUpperCase()));
console.log(`  🏆 Top Ranking VVIP Counters (${topRankingPicks.length}): ${[...topRankingNames].join(', ') || 'none'}`);

// -------------------------------------------------------------
// TEST 4: Cross-Verification of Mandatory Active Holdings
// -------------------------------------------------------------
console.log('\n[4] Cross-Verification of Mandatory Candidates...');

// Only active trades entered on the current snapshot day are cross-checked for entry eligibility,
// unless it has since dipped deep (> 10%) or already run extended (> 10% above entry) — no longer an entry zone.
for (const trade of tradesOnLatestDate) {
    const sym = trade.name.toUpperCase();
    const liveItem = liveData.find(x => (x.name || '').toUpperCase() === sym);

    // Skip if stock not found in live_data (no volume/trading that day — stale data scenario)
    if (!liveItem) {
        console.log(`  ℹ️  Skip [${sym}] — not found in live_data (no trading data available, possibly stale snapshot)`);
        continue;
    }

    const isDippingDeep = liveItem.pullback > 10.0 || liveItem.changePct < -5.0;
    const isExtended = trade.entry > 0 && ((liveItem.price - trade.entry) / trade.entry) * 100 > 10.0;
    const tightThreshold = (trade.entryType && trade.entryType.includes('ADD-ON')) ? 3.5 : 10.0;
    const isLoose = typeof liveItem.closeTightness === 'number' && liveItem.closeTightness > tightThreshold;
    const effF = effFloorOf(liveItem);
    const fDist = effF ? ((liveItem.price - effF) / effF * 100) : 99;
    const isFloorTooFar = fDist > 5.0 || fDist < -2.0;

    if (isDippingDeep || isExtended || isLoose || isFloorTooFar) {
        const reason = isExtended ? 'extended >10% from entry' : 
                       isLoose ? `loose tightness ${liveItem.closeTightness.toFixed(2)}% > ${tightThreshold}%` : 
                       isFloorTooFar ? `floor dist ${fDist.toFixed(1)}% outside [-2%, 5%]` :
                       `deep dip pullback ${liveItem.pullback?.toFixed(1)}%`;
        console.log(`  ℹ️  Skip [${sym}] — ${reason} (not an entry zone)`);
        continue;
    }
    assert(topRankingNames.has(sym), `Latest Tracker Entry [${sym}] (${trade.entryType}) must appear in Scanner Top Ranking VVIP`);
}

// Every Top Ranking pick MUST be one of the 3 entry types (NEW / ADD-ON A+ / LANTAI RAPAT)
const invalidTypePicks = topRankingPicks.filter(p => ![0, 1, 2].includes(frFreshness(p)));
assert(invalidTypePicks.length === 0, `Top Ranking only contains NEW / ADD-ON A+ / LANTAI RAPAT (invalid: ${invalidTypePicks.map(p => p.name).join(', ') || 'none'})`);

// Extended / loose-tightness holdings must NOT be shown as entry signals
for (const sym of ['BUSCAP', 'STRATUS']) {
    const it = liveData.find(x => (x.name || '').toUpperCase() === sym);
    const tg = it && typeof it.closeTightness === 'number' ? it.closeTightness : 0;
    if (it && tg > 4.85 && frFreshness(it) !== 0) {
        assert(!topRankingNames.has(sym), `Extended holding [${sym}] (tightness ${tg.toFixed(2)}%) must NOT appear as entry signal`);
    }
}

// -------------------------------------------------------------
// TEST 5: Verify Traps are Properly Filtered Out (Negative Tests)
// -------------------------------------------------------------
console.log('\n[5] Negative Verification: Traps & Red Candles Must Be Blocked...');

// Evaluate today's data; a historical dump does not ban a recovered stock forever.
const blockedDumps = liveData.filter(it => it && it.name && it.pullback > 10 &&
    (frTrackMap.get(it.name.toUpperCase()) || {}).status !== 'OPEN');
const leakedDumps = blockedDumps.filter(it => topRankingNames.has(it.name.toUpperCase()));
assert(leakedDumps.length === 0, `Untracked deep dumps are excluded (${leakedDumps.map(it => it.name).join(', ') || 'none leaked'})`);

// -------------------------------------------------------------
// TEST 6: Hot Theme Sync Verification
// -------------------------------------------------------------
console.log('\n[6] Hot Theme Tracker Sync...');
const htOpenAll = htTracker.trades.filter(t => t.status === 'OPEN');
const htOpenNames = [...new Set(htOpenAll.map(t => t.name.toUpperCase()))];
console.log(`  🔥 Hot Theme Active Open Picks (${htOpenNames.length}): ${htOpenNames.slice(0, 10).join(', ')}...`);
const htIssues = trackerIssues(htTracker);
assert(htIssues.length === 0, `Hot Theme trade records and summary are consistent (${htIssues.join('; ') || 'valid'})`);
const htParts = ['HOT_THEME_NEW_TRACKER', 'HOT_THEME_ADDON_TRACKER', 'HOT_THEME_FLOOR_TRACKER']
    .flatMap(key => (htWindow[key] && htWindow[key].trades) || []);
const htRecord = t => JSON.stringify(t);
const htCombined = new Set(htTracker.trades.map(htRecord));
assert(htParts.length === htTracker.trades.length && htParts.every(t => htCombined.has(htRecord(t))),
    'Hot Theme unified tracker matches NEW / ADD-ON / FLOOR records, including legitimate exits');

// SOP Guard: HT & FR Top Ranking hanya NEW / ADD-ON A+ / LANTAI RAPAT (tiada pintu belakang Tier A+ / Fusion / Tracker OPEN)
assert(!indexSrc.includes('return t.isTierAPlus || ((fresh === 1 || fresh === 2 || isFusion)'), `HT Top Ranking has no Tier A+ / Fusion backdoor`);
assert(indexSrc.includes("family:'ht', freshness:htFreshness(p.item)"), `HT Top Ranking uses the shared entry evaluator`);
assert(!indexSrc.includes('if (isTrackerConfirmedOpen || t.isTierAPlus || t.isTierA) return true;'), `FR Top Ranking has no Tracker OPEN / Tier A backdoor`);

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n' + '='.repeat(70));
console.log(`📊 FINAL SYNC AUDIT RESULT: ${passCount} PASSED, ${failCount} FAILED`);
console.log('='.repeat(70));

if (failCount > 0) {
    console.error(`\n🚨 AUDIT FAILED! There are ${failCount} failed checks. Fix them before pushing!`);
    process.exit(1);
} else {
    console.log(`\n✅ Tracker structure and evaluated scanner filter checks passed.`);
    console.log(`   Coverage: current default Fresh Rider filters, tracker records and sampled Hot Theme guards.\n`);
    process.exit(0);
}
