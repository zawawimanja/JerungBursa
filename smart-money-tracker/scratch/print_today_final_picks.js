const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

// Helper to determine if Fresh IPO
function isFreshIpo(item) {
    if (!item) return false;
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return false;
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('AVOID')) return false;
    if (item.ipoYear !== undefined) {
        return item.ipoYear >= 2025;
    }
    return false;
}

// Helper to calculate style
const getItemStyle = (item) => {
    if (item.setupStyle) return item.setupStyle;
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    return (pct >= 5.0 || (pct >= 3.5 && pb > 5.0)) ? 'EXPLOSIVE' : (
        (pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2))) ? 'STAIRCASE' : 'SWING PLAY'
    );
};

// Filter items using the live index.html filter criteria (ALL_IPOS, limit 12%)
let validPicks = currentData.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
    const isPremiumIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B';
    const maxPullbackLimit = isIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    if (!hasPullback) return false;

    // Check avoid signal
    if (item.signal === 'avoid') return false;
    
    // Check price and turnover
    if (item.price < 0.25 || item.price > 4.00) return false;
    const minTurnover = isIpo ? 400000 : 750000;
    if (item.turnover < minTurnover) return false;
    
    // Check score
    // Helper to calculate smart score
    let score = 0;
    const pb = item.pullback !== null ? item.pullback : 0;
    if (pb >= 5.0 && pb <= 15.0) score += 3;
    else if (pb > 15.0 && pb <= 30.0) score += 2;
    else if (pb > 30.0 && pb <= 45.0) score += 1;
    if (item.isConsolidation) score += 2;
    else if (item.touchCount && item.touchCount >= 2) score += 1;
    const ct = item.closeTightness || 99;
    const lt = item.lowTightness || 99;
    if (ct <= 3.5 && lt <= 3.5) score += 2;
    else if (ct <= 5.5 || lt <= 5.5) score += 1;
    if (item.turnover >= 3000000) score += 3;
    else if (item.turnover >= 1000000) score += 2;
    else if (item.turnover >= 400000) score += 1;
    const price = item.price;
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    if (item.turnover >= 5000000) score += 1;
    if (item.ipoGrade === 'A') score += 3;
    else if (item.ipoGrade === 'B') score += 2;
    else if (item.ipoGrade === 'C') score += 1;
    if (pb <= 3.0 && isAboveSma50 && isAboveSma200) score += 2;
    const isFresh = isFreshIpo(item);
    const style = getItemStyle(item);
    if (isFresh && (style === 'EXPLOSIVE')) score += 2;
    const finalScore = Math.min(15, score);
    
    const minScore = isPremiumIpo ? 10 : (item.ipoGrade === 'C' ? 11 : 12);
    if (finalScore < minScore) return false;

    // Filter to ALL IPOs (2019-2026)
    if (!isIpo) return false;

    // Strict risk check (12%)
    const floor = item.floorLow || (item.price * 0.95);
    const distToFloor = ((item.price - floor) / floor) * 100;
    if (distToFloor > 12.0) return false;

    item.calculatedScore = finalScore;
    item.distToFloor = distToFloor;
    item.calculatedStyle = style;
    return true;
});

// Sort using the new renderSortFn logic
validPicks.sort((a, b) => {
    const isFreshA = isFreshIpo(a);
    const isFreshB = isFreshIpo(b);
    const rankA = isFreshA ? 1 : 2;
    const rankB = isFreshB ? 1 : 2;

    if (rankA !== rankB) {
        return rankA - rankB; // Fresh first, then Mature
    }

    // Group by Setup Style (EXPLOSIVE = 1, STAIRCASE = 2, SWING PLAY = 3)
    const styleRankA = a.calculatedStyle === 'EXPLOSIVE' ? 1 : (a.calculatedStyle === 'STAIRCASE' ? 2 : 3);
    const styleRankB = b.calculatedStyle === 'EXPLOSIVE' ? 1 : (b.calculatedStyle === 'STAIRCASE' ? 2 : 3);

    if (styleRankA !== styleRankB) {
        return styleRankA - styleRankB; // Sort EXPLOSIVE to the top
    }

    return a.distToFloor - b.distToFloor; // Sort by distToFloor ascending
});

console.log("=== TODAY'S FILTERED RENDERED PICKS (ALL IPOS, 12% CAP) ===");
validPicks.forEach((p, idx) => {
    const isFresh = isFreshIpo(p);
    console.log(`${(idx + 1).toString().padEnd(2)} | Stock: ${p.name.padEnd(8)} | Score: ${p.calculatedScore}/15 | Cat: ${isFresh ? 'Fresh' : 'Mature'} | Style: ${p.calculatedStyle.padEnd(10)} | Price: RM ${p.price.toFixed(3)} | Floor: RM ${p.floorLow.toFixed(3)} | Dist: ${p.distToFloor.toFixed(1)}% | SL: RM ${Math.max(p.price * 0.90, p.floorLow * 0.97).toFixed(3)}`);
});
