const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(filePath, 'utf8');

// Extract fullData array
const match = content.match(/const fullData = \[\s*([\s\S]*?)\s*\];/);
if (!match) {
    console.error("Could not find fullData in backtest.html");
    process.exit(1);
}

// Safely parse the list of objects
const fullDataRaw = eval('[' + match[1] + ']');

function calculateSmartScore(item) {
    let score = 0;
    const price = item.entryPrice || item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null && item.pullback !== undefined ? item.pullback : 0;
    
    // 1. Proximity to Floor (Safer Entry)
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    // 2. Floor Strength (Support touches)
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;
    
    // 3. Consolidation Base
    if (item.isConsolidation) score += 2;
    
    // 4. Zon Emas Pullback (ATH / RBS)
    if (pullbackVal <= 5.0) score += 3; // RBS/Near ATH
    else if (pullbackVal <= 12.0) score += 2; // Healthy pullback
    else if (pullbackVal <= 25.0) score += 1;
    
    // 5. SMA Trend Alignment
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    // 6. High volume spike confirmation (Liquidity score booster)
    if (item.turnover >= 5000000) score += 1;
    
    return score;
}

// Run through each trade and flag if it is VVIP
// Let's first group the dates
const datesList = [...new Set(fullDataRaw.map(r => r.date))].sort();

const hybridTrades = [];
datesList.forEach((date, dateIdx) => {
    const dayRows = fullDataRaw.filter(r => r.date === date);
    const exps = dayRows.filter(r => r.style === 'EXPLOSIVE');
    const stairs = dayRows.filter(r => r.style === 'STAIRCASE');
    
    // Had Top 6 + Turnover Min RM 1.5M
    const filteredExps = exps.filter(t => t.turnover >= 1500000);
    const filteredStairs = stairs.filter(t => t.turnover >= 1500000);
    
    // Sort by turnover descending to rank (matching backtest.html)
    const sortFn = (a, b) => (b.turnover || 0) - (a.turnover || 0);
    filteredExps.sort(sortFn);
    filteredStairs.sort(sortFn);
    
    const selectedExps = filteredExps.slice(0, 6);
    const selectedStairs = filteredStairs.slice(0, 6);
    
    const prevPicks = [];
    if (dateIdx > 0) {
        const prevDate = datesList[dateIdx - 1];
        const prevDayRows = fullDataRaw.filter(r => r.date === prevDate);
        prevDayRows.forEach(t => prevPicks.push(t.name));
    }
    
    selectedExps.forEach(t => {
        const item = { ...t };
        const score = calculateSmartScore(t);
        item.score = score;
        if (prevPicks.includes(t.name) && score >= 8) {
            item.isVvip = true;
        }
        hybridTrades.push(item);
    });
    selectedStairs.forEach(t => {
        const item = { ...t };
        const score = calculateSmartScore(t);
        item.score = score;
        if (prevPicks.includes(t.name) && score >= 8) {
            item.isVvip = true;
        }
        hybridTrades.push(item);
    });
});

console.log("=== TOTAL HYBRID TRADES IN DATASET:", hybridTrades.length);

// Analyze VVIP trades only (since VVIP is our core strategy)
const vvipTrades = hybridTrades.filter(t => t.isVvip);
console.log("=== TOTAL VVIP SIGNALS:", vvipTrades.length);

function getStats(list) {
    let total = list.length;
    if (total === 0) return { total: 0, wins: 0, losses: 0, slHits: 0, winRate: 0, slRate: 0, avgReturn: 0 };
    let wins = 0;
    let slHits = 0;
    let totalReturn = 0;
    list.forEach(t => {
        if (t.status.startsWith('PROFIT')) wins++;
        if (t.status === 'SL_HIT') slHits++;
        totalReturn += t.finalGain;
    });
    return {
        total,
        wins,
        slHits,
        winRate: ((wins / total) * 100).toFixed(1) + "%",
        slRate: ((slHits / total) * 100).toFixed(1) + "%",
        avgReturn: (totalReturn / total).toFixed(2) + "%"
    };
}

console.log("\n=== STATS FOR ALL VVIP:");
console.log(getStats(vvipTrades));

console.log("\n=== STATS BY SCORE TIER (VVIP ONLY):");
const score15 = vvipTrades.filter(t => t.score === 15);
console.log("Score = 15 (Gold):", getStats(score15));

const score10To14 = vvipTrades.filter(t => t.score >= 10 && t.score < 15);
console.log("Score 10-14:", getStats(score10To14));

const score8To9 = vvipTrades.filter(t => t.score >= 8 && t.score < 10);
console.log("Score 8-9:", getStats(score8To9));

console.log("\n=== ALL INDIVIDUAL GOLD (15/15) TRADES:");
score15.forEach(t => {
    console.log(`- [${t.date}] ${t.name}: Price: RM${t.entryPrice}, Final: RM${t.finalPrice}, Max Gain: +${t.maxGain}%, Final Gain: ${t.finalGain}%, Status: ${t.status}`);
});

console.log("\n=== ALL INDIVIDUAL 10-14 TRADES:");
score10To14.forEach(t => {
    console.log(`- [${t.date}] ${t.name} (Score: ${t.score}): Final Gain: ${t.finalGain}%, Status: ${t.status}`);
});
