const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(filePath, 'utf8');

const match = content.match(/const fullData = \[\s*([\s\S]*?)\s*\];/);
const fullDataRaw = eval('[' + match[1] + ']');

function calculateSmartScore(item) {
    let score = 0;
    const price = item.entryPrice || item.price;
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

const datesList = [...new Set(fullDataRaw.map(r => r.date))].sort();

// Let's run simulation with different Stop Loss strategies
// 1. Current Floor-Based SL (Floor * 0.97)
// 2. Strict 3% SL from entry price
// 3. Strict 5% SL from entry price

function runSimulation(slStyle, slPct) {
    const hybridTrades = [];
    
    datesList.forEach((d, dateIdx) => {
        const dayRows = fullDataRaw.filter(r => r.date === d);
        const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && (r.turnover === undefined || r.turnover >= 750000));
        const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && (r.turnover === undefined || r.turnover >= 750000));
        
        const sortFn = (a, b) => (b.turnover || 0) - (a.turnover || 0);
        exps.sort(sortFn);
        stairs.sort(sortFn);
        
        const selectedExps = exps.slice(0, 6);
        const selectedStairs = stairs.slice(0, 6);
        
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
    
    const vvipList = hybridTrades.filter(t => t.isVvip);
    
    // Now evaluate trades under the selected SL style
    // Wait, the raw data already has finalGain and status based on Floor * 0.97.
    // To simulate a strict SL, if the raw trade was SL_HIT or had finalGain below -slPct, we cap the loss at -slPct.
    // Wait! Let's check: if the max loss is capped at -slPct, does that change the win rate?
    // If a trade went down by -4% and then rebounded to +10%, and we had a strict 3% SL, we would have been stopped out at -3% (LOSS), whereas the floor-based SL (which might be -8%) didn't get hit, and the trade ended as a PROFIT!
    // Yes! That's why floor-based SL can sometimes have a higher win rate but larger losses.
    // Let's do a simulation using the actual chart data! But wait, we don't need yahoo finance here, we can look at the "maxGain" and "finalGain" and "status" of the records, or approximate:
    // Let's see: if a trade was SL_HIT (under Floor SL), and its finalGain was -19.8%, under a strict 3% SL it would definitely be a loss of -3%.
    // What if a trade was NOT SL_HIT, but had some drawdown? In the current dataset, we only have finalGain and maxGain. We don't have the maximum drawdown (low) during the trade, except that we know if it hit the floor-based SL.
    // So we can assume:
    // - If status is SL_HIT: under strict SL, it is still a loss, but the loss is capped at -slPct (e.g. -3.00%).
    // - If status is not SL_HIT, it means the price never hit the floor-based SL. But it MIGHT have hit a tighter 3% SL. So the win rate might be slightly lower, but the losses are much smaller.
    // Let's calculate the stats assuming we just cap the SL_HIT loss at -slPct:
    
    let total = vvipList.length;
    let wins = 0;
    let slHits = 0;
    let totalReturn = 0;
    
    vvipList.forEach(t => {
        let gain = t.finalGain;
        let isSl = t.status === 'SL_HIT';
        
        if (isSl) {
            gain = -slPct; // Cap the loss
            slHits++;
        } else {
            if (t.status.startsWith('PROFIT')) wins++;
        }
        totalReturn += gain;
    });
    
    return {
        total,
        wins,
        slHits,
        winRate: ((wins / total) * 100).toFixed(1) + "%",
        slRate: ((slHits / total) * 100).toFixed(1) + "%",
        avgReturn: (totalReturn / total).toFixed(2) + "%",
        totalReturn: totalReturn.toFixed(1) + "%"
    };
}

console.log("=== VVIP SIMULATION WITH CAPPED LOSSES (Score >= 8) ===");
console.log("1. Raw Floor-Based SL (No Capping):", runSimulation('floor', 20)); // HKB loses 19.8%
console.log("2. Strict 3% SL Capped:", runSimulation('strict', 3));
console.log("3. Strict 5% SL Capped:", runSimulation('strict', 5));

function runSimulationScoreTier(minScore, maxScore, slPct) {
    const hybridTrades = [];
    datesList.forEach((d, dateIdx) => {
        const dayRows = fullDataRaw.filter(r => r.date === d);
        const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && (r.turnover === undefined || r.turnover >= 750000));
        const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && (r.turnover === undefined || r.turnover >= 750000));
        
        const sortFn = (a, b) => (b.turnover || 0) - (a.turnover || 0);
        exps.sort(sortFn);
        stairs.sort(sortFn);
        
        const selectedExps = exps.slice(0, 6);
        const selectedStairs = stairs.slice(0, 6);
        
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
    
    const vvipList = hybridTrades.filter(t => t.isVvip && t.score >= minScore && t.score <= maxScore);
    let total = vvipList.length;
    let wins = 0;
    let slHits = 0;
    let totalReturn = 0;
    
    vvipList.forEach(t => {
        let gain = t.finalGain;
        let isSl = t.status === 'SL_HIT';
        
        if (isSl) {
            gain = -slPct;
            slHits++;
        } else {
            if (t.status.startsWith('PROFIT')) wins++;
        }
        totalReturn += gain;
    });
    
    return {
        total,
        wins,
        slHits,
        winRate: ((wins / total) * 100).toFixed(1) + "%",
        slRate: ((slHits / total) * 100).toFixed(1) + "%",
        avgReturn: (totalReturn / total).toFixed(2) + "%",
        totalReturn: totalReturn.toFixed(1) + "%"
    };
}

console.log("\n=== TIER: SCORE >= 10 ===");
console.log("Raw Floor-Based SL (No Capping):", runSimulationScoreTier(10, 15, 20));
console.log("Strict 3% SL Capped:", runSimulationScoreTier(10, 15, 3));
console.log("Strict 5% SL Capped:", runSimulationScoreTier(10, 15, 5));

console.log("\n=== TIER: SCORE 8-9 ===");
console.log("Raw Floor-Based SL (No Capping):", runSimulationScoreTier(8, 9, 20));
console.log("Strict 3% SL Capped:", runSimulationScoreTier(8, 9, 3));
console.log("Strict 5% SL Capped:", runSimulationScoreTier(8, 9, 5));
