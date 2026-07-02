const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(filePath, 'utf8');

// Extract fullData
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

const datesList = [...new Set(fullData.map(r => r.date))].sort();

function testStrategy(topN, minTurnover, useBroadYesterday) {
    const hybridTrades = [];
    
    datesList.forEach((date, dateIdx) => {
        const dayRows = fullData.filter(r => r.date === date);
        
        const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && (r.turnover === undefined || r.turnover >= minTurnover));
        const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && (r.turnover === undefined || r.turnover >= minTurnover));
        
        const sortFn = (a, b) => (b.turnover || 0) - (a.turnover || 0);
        exps.sort(sortFn);
        stairs.sort(sortFn);
        
        const topExps = topN ? exps.slice(0, topN) : exps;
        const topStairs = topN ? stairs.slice(0, topN) : stairs;
        
        const prevPicks = [];
        if (dateIdx > 0) {
            const prevDate = datesList[dateIdx - 1];
            const prevDayRows = fullData.filter(r => r.date === prevDate);
            if (useBroadYesterday) {
                prevDayRows.forEach(t => prevPicks.push(t.name));
            } else {
                const prevExps = prevDayRows.filter(r => r.style === 'EXPLOSIVE' && (r.turnover === undefined || r.turnover >= minTurnover));
                const prevStairs = prevDayRows.filter(r => r.style === 'STAIRCASE' && (r.turnover === undefined || r.turnover >= minTurnover));
                prevExps.sort(sortFn);
                prevStairs.sort(sortFn);
                const sliceN = topN || 6;
                prevExps.slice(0, sliceN).forEach(t => prevPicks.push(t.name));
                prevStairs.slice(0, sliceN).forEach(t => prevPicks.push(t.name));
            }
        }
        
        topExps.forEach(t => {
            const item = { ...t };
            const score = calculateSmartScore(t);
            if (prevPicks.includes(t.name) && score >= 8) {
                item.isVvip = true;
            }
            hybridTrades.push(item);
        });
        
        topStairs.forEach(t => {
            const item = { ...t };
            const score = calculateSmartScore(t);
            if (prevPicks.includes(t.name) && score >= 8) {
                item.isVvip = true;
            }
            hybridTrades.push(item);
        });
    });
    
    const vvipList = hybridTrades.filter(t => t.isVvip);
    let winCount = 0;
    let slCount = 0;
    let totalGain = 0;
    vvipList.forEach(t => {
        if (t.status.startsWith('PROFIT')) winCount++;
        if (t.status === 'SL_HIT') slCount++;
        totalGain += t.finalGain;
    });
    
    return {
        total: vvipList.length,
        winRate: vvipList.length ? (winCount / vvipList.length * 100) : 0,
        slRate: vvipList.length ? (slCount / vvipList.length * 100) : 0,
        totalGain
    };
}

console.log("=== GRID SEARCH VVIP STRATEGY ===");
console.log("topN | Min Turnover | Broad Yesterday | Total Trades | Win Rate | SL Rate | Total Gain");
console.log("-----------------------------------------------------------------------------------------");

const configurations = [
    { topN: 6, minTurnover: 750000, useBroadYesterday: false },
    { topN: null, minTurnover: 750000, useBroadYesterday: true },
    { topN: 6, minTurnover: 750000, useBroadYesterday: true },
    { topN: 6, minTurnover: 1500000, useBroadYesterday: true },
    { topN: 4, minTurnover: 1000000, useBroadYesterday: true },
    { topN: 5, minTurnover: 1000000, useBroadYesterday: true },
    { topN: 6, minTurnover: 1000000, useBroadYesterday: true },
    { topN: 3, minTurnover: 1500000, useBroadYesterday: true },
    { topN: 2, minTurnover: 1500000, useBroadYesterday: true },
    { topN: 4, minTurnover: 750000, useBroadYesterday: true },
    { topN: 3, minTurnover: 750000, useBroadYesterday: true },
    { topN: 5, minTurnover: 750000, useBroadYesterday: true }
];

configurations.forEach(config => {
    const res = testStrategy(config.topN, config.minTurnover, config.useBroadYesterday);
    console.log(`${String(config.topN).padEnd(4)} | RM ${String(config.minTurnover/1000).padStart(4)}k      | ${String(config.useBroadYesterday).padEnd(15)} | ${String(res.total).padStart(12)} | ${res.winRate.toFixed(1).padStart(7)}% | ${res.slRate.toFixed(1).padStart(6)}% | ${res.totalGain.toFixed(1).padStart(9)}%`);
});
