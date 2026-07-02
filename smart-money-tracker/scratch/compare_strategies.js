const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(filePath, 'utf8');

// Extract fullData
const match = content.match(/const fullData = \[\s*([\s\S]*?)\s*\];/);
if (!match) {
    console.error("❌ Could not find fullData");
    process.exit(1);
}

const rowsText = match[1];
const rows = [];
const lines = rowsText.split('\n');
lines.forEach(l => {
    if (!l.trim()) return;
    try {
        let cleaned = l.trim();
        if (cleaned.endsWith(',')) cleaned = cleaned.slice(0, -1);
        const obj = eval(`(${cleaned})`);
        rows.push(obj);
    } catch(e) {}
});

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

const datesList = [...new Set(rows.map(r => r.date))].sort();

// Strategy A: Old System (Top 1 Explosive + Top 1 Staircase by Turnover, Min Turnover >= 5M)
const tradesOld = [];
datesList.forEach(d => {
    const dayRows = rows.filter(r => r.date === d);
    const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && r.turnover >= 5000000);
    const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && r.turnover >= 5000000);
    
    exps.sort((a, b) => b.turnover - a.turnover);
    stairs.sort((a, b) => b.turnover - a.turnover);
    
    if (exps[0]) tradesOld.push(exps[0]);
    if (stairs[0]) tradesOld.push(stairs[0]);
});

// Strategy B: New System (Top 3 Explosive + Top 3 Staircase by Smart Score, Min Turnover >= 1.5M)
const tradesNew = [];
datesList.forEach(d => {
    const dayRows = rows.filter(r => r.date === d);
    const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && r.turnover >= 1500000);
    const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && r.turnover >= 1500000);
    
    const sortFn = (a, b) => {
        const scoreA = calculateSmartScore(a);
        const scoreB = calculateSmartScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.turnover - a.turnover;
    };
    exps.sort(sortFn);
    stairs.sort(sortFn);
    
    exps.slice(0, 3).forEach(t => tradesNew.push(t));
    stairs.slice(0, 3).forEach(t => tradesNew.push(t));
});

function evaluate(trades, name) {
    const total = trades.length;
    let wins = 0;
    let sl = 0;
    let totalReturn = 0;
    
    trades.forEach(t => {
        if (t.status.startsWith('PROFIT')) wins++;
        if (t.status === 'SL_HIT') sl++;
        totalReturn += t.finalGain;
    });
    
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const slRate = total > 0 ? (sl / total) * 100 : 0;
    const avgReturn = total > 0 ? totalReturn / total : 0;
    
    console.log(`\n=== ${name} ===`);
    console.log(`Jumlah Trade         : ${total} transaksi`);
    console.log(`Kadar Kemenangan     : ${winRate.toFixed(2)}% (${wins} Menang)`);
    console.log(`Kadar SL Hit (3%)    : ${slRate.toFixed(2)}% (${sl} Terkena SL)`);
    console.log(`Purata PnL Per Trade : ${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}%`);
    console.log(`Jumlah Kasar PnL     : ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`);
}

evaluate(tradesOld, "STRATEGI LAMA (Top 1, Turnover >= RM 5M)");
evaluate(tradesNew, "STRATEGI BAHARU (Top 3, Smart Score, Turnover >= RM 1.5M)");
