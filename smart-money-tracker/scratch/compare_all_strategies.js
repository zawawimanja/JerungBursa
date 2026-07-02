const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(filePath, 'utf8');

const match = content.match(/const fullData = \[\s*([\s\S]*?)\s*\];/);
if (!match) { console.error("❌ Could not find fullData"); process.exit(1); }

const rows = [];
match[1].split('\n').forEach(l => {
    if (!l.trim()) return;
    try {
        let cleaned = l.trim().replace(/,$/, '');
        rows.push(eval(`(${cleaned})`));
    } catch(e) {}
});

function calculateSmartScore(item) {
    let score = 0;
    const price = item.entryPrice || item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullback = item.pullback ?? 0;

    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;

    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;

    if (item.isConsolidation) score += 2;

    if (pullback <= 5.0) score += 3;
    else if (pullback <= 12.0) score += 2;
    else if (pullback <= 25.0) score += 1;

    if (item.sma50 && price >= item.sma50) score += 2;
    if (item.sma200 && price >= item.sma200) score += 1;
    if (item.turnover >= 5000000) score += 1;

    return score;
}

const datesList = [...new Set(rows.map(r => r.date))].sort();

function evaluate(trades) {
    if (trades.length === 0) return { total: 0, winRate: 0, slRate: 0, avgPnl: 0, totalPnl: 0 };
    let wins = 0, sl = 0, totalPnl = 0;
    trades.forEach(t => {
        if (t.status.startsWith('PROFIT')) wins++;
        if (t.status === 'SL_HIT') sl++;
        totalPnl += t.finalGain;
    });
    return {
        total: trades.length,
        winRate: (wins / trades.length * 100),
        slRate: (sl / trades.length * 100),
        avgPnl: totalPnl / trades.length,
        totalPnl
    };
}

function runStrategy({ topN, minTurnover, sortBy, styleFilter, minScore }) {
    const trades = [];
    datesList.forEach(d => {
        let dayRows = rows.filter(r => r.date === d && r.turnover >= minTurnover);

        const sortFn = sortBy === 'score'
            ? (a, b) => { const sd = calculateSmartScore(b) - calculateSmartScore(a); return sd !== 0 ? sd : b.turnover - a.turnover; }
            : (a, b) => b.turnover - a.turnover;

        // Apply style filter
        const stylesToRun = styleFilter === 'EXPLOSIVE_ONLY' ? ['EXPLOSIVE']
            : styleFilter === 'STAIRCASE_ONLY' ? ['STAIRCASE']
            : ['EXPLOSIVE', 'STAIRCASE'];

        stylesToRun.forEach(style => {
            let candidates = dayRows.filter(r => r.style === style);
            candidates.sort(sortFn);
            if (minScore !== undefined) {
                candidates = candidates.filter(r => calculateSmartScore(r) >= minScore);
            }
            candidates.slice(0, topN).forEach(t => trades.push(t));
        });
    });
    return evaluate(trades);
}

const strategies = [
    { label: 'A - Top 1, Turnover >= 5M, By Turnover (LAMA)',         topN: 1, minTurnover: 5000000, sortBy: 'turnover',   styleFilter: 'BOTH',           minScore: undefined },
    { label: 'B - Top 3, Turnover >= 1.5M, By SmartScore (BAHARU)',   topN: 3, minTurnover: 1500000, sortBy: 'score',      styleFilter: 'BOTH',           minScore: undefined },
    { label: 'C - Top 1, Turnover >= 1.5M, By SmartScore',            topN: 1, minTurnover: 1500000, sortBy: 'score',      styleFilter: 'BOTH',           minScore: undefined },
    { label: 'D - Top 2, Turnover >= 1.5M, By SmartScore',            topN: 2, minTurnover: 1500000, sortBy: 'score',      styleFilter: 'BOTH',           minScore: undefined },
    { label: 'E - Top 5, Turnover >= 1.5M, By SmartScore',            topN: 5, minTurnover: 1500000, sortBy: 'score',      styleFilter: 'BOTH',           minScore: undefined },
    { label: 'F - Top 3, Turnover >= 1M, By SmartScore',              topN: 3, minTurnover: 1000000, sortBy: 'score',      styleFilter: 'BOTH',           minScore: undefined },
    { label: 'G - Top 3, Turnover >= 3M, By SmartScore',              topN: 3, minTurnover: 3000000, sortBy: 'score',      styleFilter: 'BOTH',           minScore: undefined },
    { label: 'H - Top 3, Turnover >= 1.5M, By SmartScore, Score >= 8', topN: 3, minTurnover: 1500000, sortBy: 'score',    styleFilter: 'BOTH',           minScore: 8 },
    { label: 'I - Top 3, Turnover >= 1.5M, By SmartScore, Score >= 9', topN: 3, minTurnover: 1500000, sortBy: 'score',    styleFilter: 'BOTH',           minScore: 9 },
    { label: 'J - Top 3 EXPLOSIVE Only, Turnover >= 1.5M, SmartScore', topN: 3, minTurnover: 1500000, sortBy: 'score',    styleFilter: 'EXPLOSIVE_ONLY', minScore: undefined },
    { label: 'K - Top 3 STAIRCASE Only, Turnover >= 1.5M, SmartScore', topN: 3, minTurnover: 1500000, sortBy: 'score',    styleFilter: 'STAIRCASE_ONLY', minScore: undefined },
    { label: 'L - Top 3, Turnover >= 1.5M, By Turnover (No SmartScore)',topN: 3, minTurnover: 1500000, sortBy: 'turnover', styleFilter: 'BOTH',           minScore: undefined },
];

console.log('\n📊 PERBANDINGAN SISTEMATIK PELBAGAI SOP BACKTEST');
console.log(`📅 Tempoh: ${datesList[0]} hingga ${datesList[datesList.length-1]}`);
console.log('='.repeat(115));
console.log('SOP'.padEnd(55) + ' | Trades | Win Rate | SL Rate | Avg PnL/Trade | Total PnL');
console.log('-'.repeat(115));

const results = [];
strategies.forEach(s => {
    const r = runStrategy(s);
    results.push({ ...s, ...r });
    const wr = r.winRate.toFixed(1).padStart(6) + '%';
    const slr = r.slRate.toFixed(1).padStart(5) + '%';
    const avg = (r.avgPnl >= 0 ? '+' : '') + r.avgPnl.toFixed(2).padStart(6) + '%';
    const tot = (r.totalPnl >= 0 ? '+' : '') + r.totalPnl.toFixed(1).padStart(7) + '%';
    console.log(`${s.label.substring(0, 54).padEnd(54)} | ${String(r.total).padStart(6)} | ${wr} | ${slr}  | ${avg}          | ${tot}`);
});

// Find best by avgPnl
results.sort((a, b) => b.avgPnl - a.avgPnl);
console.log('\n🏆 TERBAIK MENGIKUT PURATA PNL PER TRADE:');
results.slice(0, 3).forEach((r, i) => console.log(`  ${i+1}. ${r.label} → +${r.avgPnl.toFixed(2)}% avg`));

results.sort((a, b) => b.totalPnl - a.totalPnl);
console.log('\n💰 TERBAIK MENGIKUT JUMLAH PNL TERKUMPUL:');
results.slice(0, 3).forEach((r, i) => console.log(`  ${i+1}. ${r.label} → +${r.totalPnl.toFixed(1)}%`));

results.sort((a, b) => b.winRate - a.winRate);
console.log('\n🎯 TERBAIK MENGIKUT WIN RATE:');
results.slice(0, 3).forEach((r, i) => console.log(`  ${i+1}. ${r.label} → ${r.winRate.toFixed(1)}% Win Rate`));
