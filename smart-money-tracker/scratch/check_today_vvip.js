const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../live_data.json');
if (!fs.existsSync(dataPath)) {
    console.error("❌ live_data.json not found!");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Helper to determine if sleeping/avoid stock
function isSleepingOrAvoidStock(item) {
    const name = item.name.toUpperCase();
    // Common penny stocks / structured warrants to avoid
    if (name.includes('-C') || name.includes('-H') || name.includes('-R') || name.includes('-W')) return true;
    
    // Average daily range / volatility checks if any
    if (item.price < 0.10) return true;
    return false;
}

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null && item.pullback !== undefined ? item.pullback : 0;
    
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

const validPicks = data.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    if (!hasPullback) return false;

    if (isSleepingOrAvoidStock(item)) return false;
    if (item.price < 0.25 || item.price > 4.00) return false;
    if (item.turnover < 750000) return false;

    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'EXPLOSIVE' || style === 'STAIRCASE';
});

// Separate and rank
const exps = validPicks.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'EXPLOSIVE';
});

const stairs = validPicks.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'STAIRCASE';
});

const renderSortFn = (a, b) => {
    const scoreA = calculateSmartScore(a);
    const scoreB = calculateSmartScore(b);
    const isVvipA = (a.isVvip && scoreA >= 8) ? 1 : 0;
    const isVvipB = (b.isVvip && scoreB >= 8) ? 1 : 0;

    if (isVvipB !== isVvipA) {
        return isVvipB - isVvipA;
    }
    if (scoreB !== scoreA) {
        return scoreB - scoreA;
    }
    return b.turnover - a.turnover;
};

exps.sort(renderSortFn);
stairs.sort(renderSortFn);

const topExps = exps.slice(0, 6);
const topStairs = stairs.slice(0, 6);

console.log("=== HARI INI: CADANGAN HIBRID (SKOR >= 8) ===");
console.log("\n🚀 EXPLOSIVE SELECTION:");
let expCount = 0;
topExps.forEach(t => {
    const score = calculateSmartScore(t);
    if (score >= 8) {
        expCount++;
        console.log(`- ${t.name} (Price: RM ${t.price.toFixed(3)}, Score: ${score}/15, Turnover: RM ${(t.turnover/1e6).toFixed(2)}M, Pullback: ${t.pullback ? t.pullback.toFixed(1) : 0}%)`);
    }
});
if (expCount === 0) console.log("Tiada kaunter.");

console.log("\n🪜 STAIRCASE SELECTION:");
let stairCount = 0;
topStairs.forEach(t => {
    const score = calculateSmartScore(t);
    if (score >= 8) {
        stairCount++;
        console.log(`- ${t.name} (Price: RM ${t.price.toFixed(3)}, Score: ${score}/15, Turnover: RM ${(t.turnover/1e6).toFixed(2)}M, Pullback: ${t.pullback ? t.pullback.toFixed(1) : 0}%)`);
    }
});
if (stairCount === 0) console.log("Tiada kaunter.");
