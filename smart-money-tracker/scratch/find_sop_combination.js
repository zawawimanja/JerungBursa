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

// Loop through parameters
const turnoverOptions = [0, 500000, 750000, 1000000, 1500000, 2000000, 3000000, 5000000];
const limitOptions = ['none', 'top6', 'top3'];
const scoreOptions = [8, 9, 10, 11, 12, 13, 14, 15];

console.log("Searching combinations...");

for (const minTurnover of turnoverOptions) {
    for (const limitVal of limitOptions) {
        for (const minScore of scoreOptions) {
            
            const hybridTrades = [];
            datesList.forEach((d, dateIdx) => {
                const dayRows = fullDataRaw.filter(r => r.date === d);
                
                const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && (r.turnover === undefined || r.turnover >= minTurnover));
                const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && (r.turnover === undefined || r.turnover >= minTurnover));
                
                const sortFn = (a, b) => (b.turnover || 0) - (a.turnover || 0);
                exps.sort(sortFn);
                stairs.sort(sortFn);
                
                let selectedExps = exps;
                let selectedStairs = stairs;
                
                if (limitVal === 'top6') {
                    selectedExps = exps.slice(0, 6);
                    selectedStairs = stairs.slice(0, 6);
                } else if (limitVal === 'top3') {
                    selectedExps = exps.slice(0, 3);
                    selectedStairs = stairs.slice(0, 3);
                }
                
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
                    if (prevPicks.includes(t.name) && score >= minScore) {
                        item.isVvip = true;
                    }
                    hybridTrades.push(item);
                });
                selectedStairs.forEach(t => {
                    const item = { ...t };
                    const score = calculateSmartScore(t);
                    item.score = score;
                    if (prevPicks.includes(t.name) && score >= minScore) {
                        item.isVvip = true;
                    }
                    hybridTrades.push(item);
                });
            });
            
            const vvipList = hybridTrades.filter(t => t.isVvip);
            const total = vvipList.length;
            if (total > 0) {
                let wins = 0;
                let slHits = 0;
                vvipList.forEach(t => {
                    if (t.status.startsWith('PROFIT')) wins++;
                    if (t.status === 'SL_HIT') slHits++;
                });
                const winRate = (wins / total) * 100;
                
                // We are looking for: total = 16, wins = 13 (which is 81.25% or 81.3%)
                if (total === 16 && wins === 13) {
                    console.log(`FOUND EXACT COMBINATION:`);
                    console.log(`Min Turnover: ${minTurnover}`);
                    console.log(`Limit: ${limitVal}`);
                    console.log(`Min Score: ${minScore}`);
                    console.log(`Wins: ${wins}, Total: ${total}, Win Rate: ${winRate.toFixed(1)}%`);
                    console.log(`SL Hits: ${slHits} (${((slHits/total)*100).toFixed(1)}%)`);
                    console.log("------------------------");
                }
                // Also log near matches
                if (Math.abs(winRate - 81.3) < 2.0 && total >= 10 && total <= 30) {
                    console.log(`NEAR MATCH: Min Turnover: ${minTurnover}, Limit: ${limitVal}, Min Score: ${minScore} => Wins: ${wins}/${total} (${winRate.toFixed(1)}%), SL: ${slHits}`);
                }
            }
        }
    }
}
