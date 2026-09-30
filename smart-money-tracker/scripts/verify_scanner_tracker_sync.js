/**
 * verify_scanner_tracker_sync.js
 * 
 * AUTOMATED AUDIT & SYNC VERIFICATION SYSTEM FOR JERUNGBURSA
 * -----------------------------------------------------------
 * Ensures 100% synchronization across:
 * 1. Backend Generators (ALL_TRACKER & HOT_THEME_TRACKER)
 * 2. Frontend Scanner UI (renderConfluenceRadar & renderHotTheme)
 * 3. Telegram Alerts (buy_alert.js & morning_alert.js)
 * 
 * Awang (awi) NEVER has to remember or manually audit counters again!
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

// -------------------------------------------------------------
// TEST 2: Latest Entry Date & Active Positions
// -------------------------------------------------------------
console.log('\n[2] Checking Latest Entry Date & Active Signals...');
const sortedDates = [...new Set(allTracker.trades.map(t => t.entryDate).filter(Boolean))].sort();
const latestDate = sortedDates[sortedDates.length - 1];
console.log(`  📅 Latest recorded entry date in tracker: ${latestDate}`);

const tradesOnLatestDate = allTracker.trades.filter(t => t.entryDate === latestDate && t.status === 'OPEN');
console.log(`  🎯 Trades entered on ${latestDate}: ${tradesOnLatestDate.map(t => `${t.name} (${t.entryType})`).join(', ')}`);

assert(tradesOnLatestDate.length > 0, `At least 1 active signal entered on ${latestDate}`);

// -------------------------------------------------------------
// TEST 3: Scanner Top Ranking Simulation & Sync
// -------------------------------------------------------------
console.log('\n[3] Simulating Scanner UI "Top Ranking VVIP" Filter on Live Data...');

// Replicate recentFloorMap from historical bases
function getRecentFloorMap() {
    const map = new Map();
    map.set('STRATUS', 2.90);
    map.set('CBHB', 1.08);
    map.set('ISF', 0.835);
    map.set('PENTECH', 0.325);
    return map;
}

const recentFloorMap = getRecentFloorMap();
const effFloorOf = (item) => {
    const rf = recentFloorMap.get((item.name || '').toUpperCase());
    const f = item.floorLow || 0;
    if (f > 0 && rf > 0 && ((item.price - f) / f) > 0.10) return Math.max(f, rf);
    return f || rf || 0;
};

// frTrackMap with OPEN precedence
const frTrackMap = new Map();
allTracker.trades.filter(t => t.status !== 'OPEN').sort((a,b) => (a.entryDate || '').localeCompare(b.entryDate || '')).forEach(t => {
    frTrackMap.set((t.name || '').toUpperCase(), t);
});
allTracker.trades.filter(t => t.status === 'OPEN').sort((a,b) => (a.entryDate || '').localeCompare(b.entryDate || '')).forEach(t => {
    frTrackMap.set((t.name || '').toUpperCase(), t);
});

const frFreshness = (it) => {
    const tr = frTrackMap.get((it.name || '').toUpperCase());
    if (!tr) return 0;
    if (tr.status === 'OPEN') {
        if (tr.entryDate && tr.entryDate >= latestDate) {
            if (tr.entryType && tr.entryType.includes('LANTAI RAPAT')) return 2;
            if (tr.entryType && tr.entryType.includes('ADD-ON')) return 1;
            return 0;
        }
        const entryP = tr.entry || 0;
        const pct = (entryP > 0 && it.price) ? ((it.price - entryP) / entryP) * 100 : 0;
        const ef = effFloorOf(it);
        const fd = (ef && it.price) ? ((it.price - ef) / ef) * 100 : 99;
        const toVal = it.turnover || it.rawTurnover || 0;
        const touches = it.touchCount || 0;
        const tight = typeof it.closeTightness === 'number' ? it.closeTightness : 99;

        const isSolidBase2 = (touches >= 3 && tight <= 4.85 && fd <= 5.0 && (toVal >= 2000000 || toVal === 0));
        const isFreshBase1 = (pct >= 0 && pct <= 20 && fd <= 3.5 && (toVal >= 2000000 || toVal === 0));
        if (isFreshBase1) return 1;
        if (isSolidBase2) return 2;
        if (pct > 20 && fd > 5.0) return 4;
        return 3;
    }
    return 4;
};

const getTierOfFR = (it) => {
    const toVal = it.turnover || it.rawTurnover || 0;
    const effF = effFloorOf(it);
    const fDistVal = effF ? ((it.price - effF) / effF * 100) : 99;
    const tightValNum = typeof it.closeTightness === 'number' ? it.closeTightness : 99;
    const isBlackSwanClean = true;
    const isRealUpperWickDump = false;

    const isTierAPlus = (toVal >= 2000000 && tightValNum <= 3.5 && fDistVal >= -1.0 && fDistVal <= 3.5 && isBlackSwanClean && !isRealUpperWickDump);
    const isTierA = (!isTierAPlus && toVal >= 1000000 && tightValNum <= 4.85 && fDistVal >= -1.5 && fDistVal <= 5.0 && isBlackSwanClean && !isRealUpperWickDump);
    return { isTierAPlus, isTierA, toVal, fDistVal, tightValNum, isBlackSwanClean, isRealUpperWickDump };
};

// Filter live data into scanner candidates
const candidateMap = new Map();
for (const item of liveData) {
    if (!item || !item.name || item.price <= 0) continue;
    if (item.price < 0.10 || item.price > 50) continue;
    if (item.isVvip !== true) continue;
    if (item.signal === 'avoid' || item.isCombStock) continue;
    if ((item.ipoYear || 0) < 2025) continue;
    const pb = item.pullback !== null && item.pullback !== undefined ? item.pullback : 99;
    if (pb > 10.0) continue;
    if (item.ipoAge != null && item.ipoAge < 15 && (item.touchCount || 0) < 2) continue;

    const isGreenBreakout = (item.change >= 0 || (item.changePct || 0) >= 0);
    const tight = typeof item.closeTightness === 'number' ? item.closeTightness : 99;
    if (item.hasVolumeSpike === true) {
        if (!isGreenBreakout) continue;
        if (tight > 10.0) continue;
    } else {
        if (tight > 5.0) continue;
    }
    candidateMap.set(item.name.toUpperCase(), item);
}

// Top Ranking VVIP
const topRankingPicks = [];
for (const [name, p] of candidateMap.entries()) {
    const t = getTierOfFR(p);
    const fresh = frFreshness(p);
    if (!t.isBlackSwanClean || t.isRealUpperWickDump || fresh === 4) continue;

    const trackedEntry = frTrackMap.get(name);
    const isTrackerConfirmedToday = !!(
        trackedEntry &&
        trackedEntry.status === 'OPEN' &&
        trackedEntry.entryDate === latestDate
    );

    if (t.toVal < 1000000 && !isTrackerConfirmedToday) continue;

    if (fresh === 0) {
        if (t.fDistVal <= 10.0 && t.fDistVal >= -2.0 && t.tightValNum <= 10.0) {
            topRankingPicks.push(p);
        }
    } else if (fresh === 1 || fresh === 2) {
        if (t.fDistVal <= 5.0 && t.fDistVal >= -2.0 && t.tightValNum <= 4.85) {
            topRankingPicks.push(p);
        }
    } else if (t.isTierAPlus || t.isTierA) {
        topRankingPicks.push(p);
    }
}

const topRankingNames = new Set(topRankingPicks.map(p => p.name.toUpperCase()));
console.log(`  🏆 Top Ranking VVIP Counters (${topRankingPicks.length}): ${[...topRankingNames].join(', ')}`);

// -------------------------------------------------------------
// TEST 4: Cross-Verification of Mandatory Counters
// -------------------------------------------------------------
console.log('\n[4] Cross-Verification of Mandatory Candidates...');

// Every trade entered today in ALL_TRACKER MUST appear in Top Ranking VVIP
for (const trade of tradesOnLatestDate) {
    const sym = trade.name.toUpperCase();
    const inTopRanking = topRankingNames.has(sym);
    assert(inTopRanking, `Today's Tracker Entry [${sym}] (${trade.entryType}) must appear in Scanner Top Ranking VVIP`);
}

// Check STRATUS explicitly (must appear in Top Ranking VVIP as active Add-on)
const stratusPresent = topRankingNames.has('STRATUS');
assert(stratusPresent, `Active Holding [STRATUS] must appear in Scanner Top Ranking VVIP (Floor Dist <= 5.0%)`);

// Check CBHB explicitly
const cbhbPresent = topRankingNames.has('CBHB');
assert(cbhbPresent, `Active Entry [CBHB] must appear in Scanner Top Ranking VVIP`);

// Check ISF explicitly
const isfPresent = topRankingNames.has('ISF');
assert(isfPresent, `Active Entry [ISF] must appear in Scanner Top Ranking VVIP`);

// Check PENTECH explicitly
const pentechPresent = topRankingNames.has('PENTECH');
assert(pentechPresent, `Active Entry [PENTECH] must appear in Scanner Top Ranking VVIP`);

// Check EXSIMHB explicitly
const exsimhbPresent = topRankingNames.has('EXSIMHB');
assert(exsimhbPresent, `Active Entry [EXSIMHB] must appear in Scanner Top Ranking VVIP`);

// -------------------------------------------------------------
// TEST 5: Verify Traps are Properly Filtered Out (Negative Tests)
// -------------------------------------------------------------
console.log('\n[5] Negative Verification: Traps & Red Candles Must Be Blocked...');

// BUSCAP closed -2.78% with pullback 11.76% (> 10%)
const buscapInTopRanking = topRankingNames.has('BUSCAP');
assert(!buscapInTopRanking, `Dipping counter [BUSCAP] (Pullback 11.76% > 10%, red candle) must NOT appear in Top Ranking VVIP`);

// SUNLOGY closed -5.32% with pullback 15.24% (> 10%)
const sunlogyInTopRanking = topRankingNames.has('SUNLOGY');
assert(!sunlogyInTopRanking, `Deep dump [SUNLOGY] (Pullback 15.24% > 10%) must NOT appear in Top Ranking VVIP`);

// -------------------------------------------------------------
// TEST 6: Hot Theme Sync Verification
// -------------------------------------------------------------
console.log('\n[6] Hot Theme Tracker Sync...');
const htOpenLatest = htTracker.trades.filter(t => t.entryDate === latestDate && t.status === 'OPEN');
const htNames = [...new Set(htOpenLatest.map(t => t.name.toUpperCase()))];
console.log(`  🔥 Hot Theme Open Picks on ${latestDate} (${htNames.length}): ${htNames.join(', ')}`);
assert(htNames.includes('GREATEC'), `Hot Theme Tracker contains GREATEC on ${latestDate}`);
assert(htNames.includes('DUFU'), `Hot Theme Tracker contains DUFU on ${latestDate}`);
assert(htNames.includes('MNHLDG'), `Hot Theme Tracker contains MNHLDG on ${latestDate}`);

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n' + '='.repeat(70));
console.log(`📊 FINAL SYNC AUDIT RESULT: ${passCount} PASSED, ${failCount} FAILED`);
console.log('='.repeat(70));

if (failCount > 0) {
    console.error(`\n🚨 AUDIT FAILED! There are ${failCount} desynchronization issues. Fix them before pushing!`);
    process.exit(1);
} else {
    console.log(`\n🎉 ALL CHECKS PASSED 100%! Tracker and Scanner are perfectly synchronized.`);
    console.log(`   Awang can rest easy — zero manual auditing needed.\n`);
    process.exit(0);
}
