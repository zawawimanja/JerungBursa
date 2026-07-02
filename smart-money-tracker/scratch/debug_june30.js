const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(filePath, 'utf8');

// Extract fullData array
const startMarker = 'const fullData = [';
const endMarker = '];';
const startIdx = content.indexOf(startMarker);
const rest = content.slice(startIdx + startMarker.length - 1);
const endIdx = rest.indexOf('];');
const arrayStr = rest.slice(0, endIdx + 2);
const fullData = eval(arrayStr);

function calculateSmartScore(item) {
    let score = 0;
    const price = item.entryPrice || item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null && item.pullback !== undefined ? item.pullback : 0;
    
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    if (pullbackVal >= 1.0 && pullbackVal <= 8.0) score += 3;
    else if (pullbackVal > 8.0 && pullbackVal <= 15.0) score += 2;
    else if (pullbackVal > 15.0 && pullbackVal <= 25.0) score += 1;
    
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 1) score += 1;
    
    if (item.isConsolidation) score += 2;
    
    const ema50 = item.sma50 || 0;
    const ema200 = item.sma200 || 0;
    const isAboveSma50 = ema50 ? price >= ema50 : false;
    const isAboveSma200 = ema200 ? price >= ema200 : false;
    
    if (isAboveSma50 && ema50 > ema200) score += 2;
    else if (isAboveSma50) score += 1;
    
    return score;
}

const targetDate = '2026-06-30';
const prevDate = '2026-06-25'; // Previous day in dataset is 25th

const dayRows = fullData.filter(r => r.date === targetDate);
const prevDayRows = fullData.filter(r => r.date === prevDate);
const prevNames = prevDayRows.map(r => r.name);

console.log(`=== DEBUG FOR ${targetDate} ===`);
console.log(`Yesterday (${prevDate}) names in dataset:`, prevNames);

dayRows.forEach(row => {
    const score = calculateSmartScore(row);
    const inYesterday = prevNames.includes(row.name);
    console.log(`- ${row.name}: Score = ${score}, In Yesterday = ${inYesterday ? 'YES' : 'NO'}, Turnover = RM ${(row.turnover/1e6).toFixed(2)}M, Style = ${row.style}`);
});
