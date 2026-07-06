const fs = require('fs');
const path = require('path');

// File paths: Friday July 3rd (Archive) to Monday July 6th (Live)
const fridayFile = path.join(__dirname, '../history/data_2026-07-03.json');
const mondayFile = path.join(__dirname, '../live_data.json');

if (!fs.existsSync(fridayFile)) {
    console.error("❌ Friday's archive data (July 3rd) was not found.");
    process.exit(1);
}

if (!fs.existsSync(mondayFile)) {
    console.error("❌ Monday's live data (July 6th) was not found.");
    process.exit(1);
}

const fridayData = JSON.parse(fs.readFileSync(fridayFile, 'utf8'));
const mondayData = JSON.parse(fs.readFileSync(mondayFile, 'utf8'));

const fridayList = Array.isArray(fridayData) ? fridayData : (fridayData.topVolume || []);
const mondayList = Array.isArray(mondayData) ? mondayData : (mondayData.topVolume || []);

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

// Extract Friday's Technique C (Hibrid Premium) picks
const hybridPicks = fridayList.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    if (!hasPullback) return false;

    // Fresh IPO is exempt from avoid/downtrend filter
    const isFresh = (item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C');
    if (!isFresh && isSleepingOrAvoidStock(item)) return false;
    
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

const renderSortFn = (a, b) => {
    const scoreA = calculateSmartScore(a);
    const scoreB = calculateSmartScore(b);
    const isVvipA = (a.isVvip && scoreA >= 8) ? 1 : 0;
    const isVvipB = (b.isVvip && scoreB >= 8) ? 1 : 0;

    if (isVvipB !== isVvipA) return isVvipB - isVvipA;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.turnover - a.turnover;
};

const exps = hybridPicks.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : 'STAIRCASE'
    );
    return style === 'EXPLOSIVE';
});

const stairs = hybridPicks.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : 'STAIRCASE'
    );
    return style === 'STAIRCASE';
});

exps.sort(renderSortFn);
stairs.sort(renderSortFn);

const topExps = exps.slice(0, 6);
const topStairs = stairs.slice(0, 6);
const finalHybridPicks = [...topExps, ...topStairs];

console.log('\n📊 PRESTASI PICKS JUMAAT (3/7) PADA PASARAN ISNIN PAGI (6/7):');
console.log('\n🎯 PILIHAN UTAMA: HIBRID VVIP (TEKNIK C) - SWING PLAY');
console.log('='.repeat(95));
console.log('Nama       | Style     | Score | Entry(3/7) | Live(6/7)  | Hasil PnL% | Status');
console.log('-'.repeat(95));

let wins = 0;
let losses = 0;
let flats = 0;
let totalReturn = 0;

finalHybridPicks.forEach(p => {
    const liveStock = mondayList.find(c => c.name === p.name);
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
        
        if (pnl > 0.05) wins++;
        else if (pnl < -0.05) losses++;
        else flats++;
        totalReturn += pnl;

        console.log(`${p.name.padEnd(10)} | ${style.padEnd(9)} | ${String(score).padStart(5)} | RM ${p.price.toFixed(3)} | RM ${liveStock.price.toFixed(3)} | ${sign}${pnl.toFixed(2).padStart(5)}% | ${status}`);
    } else {
        console.log(`${p.name.padEnd(10)} | ${style.padEnd(9)} | ${String(score).padStart(5)} | RM ${p.price.toFixed(3)} | N/A        | N/A        | Tiada Volum Semasa`);
    }
});
console.log('-'.repeat(95));
const total = wins + losses;
console.log(`Win Rate: ${total > 0 ? ((wins / total) * 100).toFixed(1) : 0}% | Purata Pulangan: ${(finalHybridPicks.length > 0 ? totalReturn / finalHybridPicks.length : 0).toFixed(2)}% (Wins: ${wins}, Losses: ${losses}, Flats: ${flats})`);
console.log('='.repeat(95));
