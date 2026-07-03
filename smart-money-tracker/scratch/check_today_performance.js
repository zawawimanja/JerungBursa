const fs = require('fs');
const path = require('path');

// File paths
const yesterdayFile = path.join(__dirname, '../history/data_2026-07-02.json');
const todayFile = path.join(__dirname, '../live_data.json');

if (!fs.existsSync(yesterdayFile)) {
    console.error("❌ Yesterday's archive data (July 2nd) was not found.");
    process.exit(1);
}

if (!fs.existsSync(todayFile)) {
    console.error("❌ Today's live data (July 3rd) was not found.");
    process.exit(1);
}

const yesterdayData = JSON.parse(fs.readFileSync(yesterdayFile, 'utf8'));
const todayData = JSON.parse(fs.readFileSync(todayFile, 'utf8'));

const yesterdayList = Array.isArray(yesterdayData) ? yesterdayData : (yesterdayData.topVolume || []);
const todayList = Array.isArray(todayData) ? todayData : (todayData.topVolume || []);

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;
    
    if (item.isConsolidation) score += 2;
    
    if (pullbackVal <= 5.0) score += 3;
    else if (pullbackVal <= 12.0) score += 2;
    else if (pullbackVal <= 25.0) score += 1;
    
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    if (item.turnover >= 5000000) score += 1;
    
    return score;
}

function isSleepingOrAvoidStock(item) {
    if (!item) return false;
    if (item.isCombStock) return true;
    
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
    
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('COMB') || reason.includes('AVOID') || reason.includes('ILLIQUID')) return true;
    
    return false;
}

// Extract yesterday's Technique C (Hibrid Premium) picks
const hybridPicks = yesterdayList.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    if (!hasPullback) return false;

    if (isSleepingOrAvoidStock(item)) return false;
    if (item.price < 0.25 || item.price > 4.00) return false;
    if (item.turnover < 750000) return false;
    if (calculateSmartScore(item) < 8) return false;

    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'EXPLOSIVE' || style === 'STAIRCASE';
});

// Sort hybridPicks: VVIP first, then Score descending, then Turnover descending
const renderSortFn = (a, b) => {
    const scoreA = calculateSmartScore(a);
    const scoreB = calculateSmartScore(b);
    const isVvipA = (a.isVvip && scoreA >= 8) ? 1 : 0;
    const isVvipB = (b.isVvip && scoreB >= 8) ? 1 : 0;

    if (isVvipB !== isVvipA) return isVvipB - isVvipA;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.turnover - a.turnover;
};

// Filter by style for Technique C
const exps = hybridPicks.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'EXPLOSIVE';
});

const stairs = hybridPicks.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'STAIRCASE';
});

exps.sort(renderSortFn);
stairs.sort(renderSortFn);

const topExps = exps.slice(0, 6);
const topStairs = stairs.slice(0, 6);
const finalHybridPicks = [...topExps, ...topStairs];

// Extract yesterday's VVIP Super Trend (Position Play) picks
const superTrendPicks = yesterdayList.filter(item => {
    if (!item.high52) return false;
    if (isSleepingOrAvoidStock(item)) return false;
    if (item.price < 0.25 || item.price > 4.00) return false;
    if (item.turnover < 5000000) return false;
    if (calculateSmartScore(item) < 11) return false;
    
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'EXPLOSIVE' || style === 'STAIRCASE';
});

superTrendPicks.sort((a, b) => b.turnover - a.turnover);


console.log('\n📊 PRESTASI PICKS SEMALAM (2/7) PADA PASARAN LIVE HARI INI (3/7):');

console.log('\n🎯 PILIHAN UTAMA: HIBRID VVIP (TEKNIK C) - SWING PLAY');
console.log('='.repeat(95));
console.log('Nama       | Style     | Score | Entry(2/7) | Live(3/7)  | Hasil PnL% | Status');
console.log('-'.repeat(95));

let hybridWins = 0;
let hybridLosses = 0;
let hybridTotalPnl = 0;

finalHybridPicks.forEach(p => {
    const liveStock = todayList.find(c => c.name === p.name);
    const score = calculateSmartScore(p);
    const pct = p.changePct !== undefined ? p.changePct : p.change;
    const pb = p.pullback !== null ? p.pullback : 0;
    const style = p.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : 'STAIRCASE'
    );
    
    if (liveStock) {
        const pnl = ((liveStock.price - p.price) / p.price) * 100;
        const sign = pnl >= 0 ? '+' : '';
        const status = pnl > 0.05 ? 'UNTUNG 🟢' : pnl < -0.05 ? 'RUGI 🔴' : 'FLAT ⚪';
        
        if (pnl > 0.05) hybridWins++;
        else if (pnl < -0.05) hybridLosses++;
        hybridTotalPnl += pnl;

        console.log(`${p.name.padEnd(10)} | ${style.padEnd(9)} | ${String(score).padStart(5)} | RM ${p.price.toFixed(3)} | RM ${liveStock.price.toFixed(3)} | ${sign}${pnl.toFixed(2).padStart(5)}% | ${status}`);
    } else {
        console.log(`${p.name.padEnd(10)} | ${style.padEnd(9)} | ${String(score).padStart(5)} | RM ${p.price.toFixed(3)} | N/A        | N/A        | Tiada Volum Semasa`);
    }
});
console.log('-'.repeat(95));
const totalHybrid = hybridWins + hybridLosses;
console.log(`Win Rate: ${totalHybrid > 0 ? ((hybridWins / totalHybrid) * 100).toFixed(1) : 0}% | Purata Pulangan: ${(finalHybridPicks.length > 0 ? hybridTotalPnl / finalHybridPicks.length : 0).toFixed(2)}%`);


console.log('\n🏆 PILIHAN KHAS: VVIP SUPER TREND (POSITION PLAY) - HOLD LAMA');
console.log('='.repeat(95));
console.log('Nama       | Style     | Score | Entry(2/7) | Live(3/7)  | Hasil PnL% | Status');
console.log('-'.repeat(95));

let superWins = 0;
let superLosses = 0;
let superTotalPnl = 0;

superTrendPicks.forEach(p => {
    const liveStock = todayList.find(c => c.name === p.name);
    const score = calculateSmartScore(p);
    const pct = p.changePct !== undefined ? p.changePct : p.change;
    const pb = p.pullback !== null ? p.pullback : 0;
    const style = p.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : 'STAIRCASE'
    );
    
    if (liveStock) {
        const pnl = ((liveStock.price - p.price) / p.price) * 100;
        const sign = pnl >= 0 ? '+' : '';
        const status = pnl > 0.05 ? 'UNTUNG 🟢' : pnl < -0.05 ? 'RUGI 🔴' : 'FLAT ⚪';
        
        if (pnl > 0.05) superWins++;
        else if (pnl < -0.05) superLosses++;
        superTotalPnl += pnl;

        console.log(`${p.name.padEnd(10)} | ${style.padEnd(9)} | ${String(score).padStart(5)} | RM ${p.price.toFixed(3)} | RM ${liveStock.price.toFixed(3)} | ${sign}${pnl.toFixed(2).padStart(5)}% | ${status}`);
    } else {
        console.log(`${p.name.padEnd(10)} | ${style.padEnd(9)} | ${String(score).padStart(5)} | RM ${p.price.toFixed(3)} | N/A        | N/A        | Tiada Volum Semasa`);
    }
});
console.log('-'.repeat(95));
const totalSuper = superWins + superLosses;
if (superTrendPicks.length > 0) {
    console.log(`Win Rate: ${totalSuper > 0 ? ((superWins / totalSuper) * 100).toFixed(1) : 0}% | Purata Pulangan: ${(superTotalPnl / superTrendPicks.length).toFixed(2)}%`);
} else {
    console.log(`Tiada kaunter VVIP Super Trend semalam.`);
}
console.log('='.repeat(95));
