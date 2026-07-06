const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../history/data_2026-06-16.json');
if (!fs.existsSync(file)) {
    console.error("File not found!");
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.topVolume || []);

// Replicate calculateSmartScore:
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
    
    // Premium booster:
    if (item.ipoGrade === 'A') score += 3;
    else if (item.ipoGrade === 'B') score += 2;
    else if (item.ipoGrade === 'C') score += 1;
    
    return score;
}

const stairs = [];
const exps = [];

list.forEach(item => {
    // Basic filter:
    const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const maxPullbackLimit = isIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
    if (pullbackVal < 0 || pullbackVal > maxPullbackLimit) return;
    
    // Sleeping/Avoid filter:
    if (item.isCombStock) return;
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return;
    if (item.price < 0.25 || item.price > 4.00) return;
    
    const minTurnover = isIpo ? 400000 : 750000;
    if (item.turnover < minTurnover) return;
    
    const score = calculateSmartScore(item);
    const style = (item.setupStyle || '').toUpperCase();
    
    const obj = {
        name: item.name,
        price: item.price,
        score: score,
        turnover: item.turnover,
        style: style,
        distToFloor: item.floorLow ? (((item.price - item.floorLow) / item.floorLow) * 100) : 99
    };
    
    if (style === 'STAIRCASE') stairs.push(obj);
    if (style === 'EXPLOSIVE') exps.push(obj);
});

stairs.sort((a, b) => b.score !== a.score ? b.score - a.score : b.turnover - a.turnover);
exps.sort((a, b) => b.score !== a.score ? b.score - a.score : b.turnover - a.turnover);

console.log("=== STAIRCASE CANDIDATES ON JUNE 16 ===");
stairs.slice(0, 10).forEach((s, idx) => {
    console.log(`${idx+1}. ${s.name} - Score: ${s.score} | Price: RM ${s.price} | Turnover: RM ${(s.turnover/1000000).toFixed(3)}M | distToFloor: ${s.distToFloor.toFixed(1)}%`);
});

console.log("\n=== EXPLOSIVE CANDIDATES ON JUNE 16 ===");
exps.slice(0, 10).forEach((e, idx) => {
    console.log(`${idx+1}. ${e.name} - Score: ${e.score} | Price: RM ${e.price} | Turnover: RM ${(e.turnover/1000000).toFixed(3)}M | distToFloor: ${e.distToFloor.toFixed(1)}%`);
});
