const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(filePath, 'utf8');

// Extract fullData array content
const match = content.match(/const fullData = \[\s*([\s\S]*?)\s*\];/);
if (!match) {
    console.error("❌ Could not find fullData in backtest.html");
    process.exit(1);
}

// Convert mock data rows into Javascript objects
const rowsText = match[1];
const rows = [];

// Parse rows dynamically
const lines = rowsText.split('\n');
lines.forEach(l => {
    if (!l.trim()) return;
    try {
        // Clean line to make it valid JSON-like object
        let cleaned = l.trim();
        if (cleaned.endsWith(',')) cleaned = cleaned.slice(0, -1);
        
        // Use eval safely to parse since it's javascript format
        const obj = eval(`(${cleaned})`);
        rows.push(obj);
    } catch(e) {
        // Skip parsing errors for empty or comment lines
    }
});

console.log(`Berjaya memuatkan ${rows.length} rekod trade dari backtest.html.`);

// Simulation logic replica
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

const hybridTrades = [];
const datesList = [...new Set(rows.map(r => r.date))].sort();

datesList.forEach(d => {
    const dayRows = rows.filter(r => r.date === d);
    
    const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && (r.turnover === undefined || r.turnover >= 1500000));
    const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && (r.turnover === undefined || r.turnover >= 1500000));
    
    const sortFn = (a, b) => {
        const scoreA = calculateSmartScore(a);
        const scoreB = calculateSmartScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.turnover || 0) - (a.turnover || 0);
    };
    exps.sort(sortFn);
    stairs.sort(sortFn);
    
    const topExps = exps.slice(0, 3);
    const topStairs = stairs.slice(0, 3);
    
    topExps.forEach(t => hybridTrades.push(t));
    topStairs.forEach(t => hybridTrades.push(t));
});

const totalHybrid = hybridTrades.length;
let hybridWins = 0;
let hybridSlHits = 0;
let hybridTotalReturn = 0;

hybridTrades.forEach(t => {
    if (t.status.startsWith('PROFIT')) hybridWins++;
    if (t.status === 'SL_HIT') hybridSlHits++;
    hybridTotalReturn += t.finalGain;
});

const hybridWinRate = (hybridWins / totalHybrid) * 100;
const hybridSlRate = (hybridSlHits / totalHybrid) * 100;
const hybridAvgReturn = hybridTotalReturn / totalHybrid;

console.log('\n==================================================');
console.log('📈 PRESTASI KESELURUHAN TEKNIK C (HIBRID PREMIUM)');
console.log(`📅 Tempoh: ${datesList[0]} hingga ${datesList[datesList.length-1]}`);
console.log('==================================================');
console.log(`Jumlah Posisi Swing : ${totalHybrid} trade`);
console.log(`Kadar Kemenangan    : ${hybridWinRate.toFixed(2)}% (${hybridWins} Menang)`);
console.log(`Kadar SL Hit (3%)   : ${hybridSlRate.toFixed(2)}% (${hybridSlHits} Terkena SL)`);
console.log(`Purata Pulangan/Trade: ${hybridAvgReturn >= 0 ? '+' : ''}${hybridAvgReturn.toFixed(2)}%`);
console.log('==================================================');
