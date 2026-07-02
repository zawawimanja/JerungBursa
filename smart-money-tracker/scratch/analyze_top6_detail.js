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

function runDetailed({ topN, minTurnover, sortBy, styleFilter, minScore, label }) {
    const allTrades = [];
    const dailyBreakdown = [];

    datesList.forEach(d => {
        let dayRows = rows.filter(r => r.date === d && r.turnover >= minTurnover);

        const sortFn = sortBy === 'score'
            ? (a, b) => { const sd = calculateSmartScore(b) - calculateSmartScore(a); return sd !== 0 ? sd : b.turnover - a.turnover; }
            : (a, b) => b.turnover - a.turnover;

        const stylesToRun = styleFilter === 'BOTH' ? ['EXPLOSIVE', 'STAIRCASE'] : ['EXPLOSIVE'];
        const dayTrades = [];

        stylesToRun.forEach(style => {
            let candidates = dayRows.filter(r => r.style === style);
            candidates.sort(sortFn);
            if (minScore !== undefined) {
                candidates = candidates.filter(r => calculateSmartScore(r) >= minScore);
            }
            candidates.slice(0, topN).forEach(t => dayTrades.push({ ...t, smartScore: calculateSmartScore(t) }));
        });

        allTrades.push(...dayTrades);
        
        let dayPnl = 0;
        let dayWins = 0;
        dayTrades.forEach(t => {
            dayPnl += t.finalGain;
            if (t.status.startsWith('PROFIT')) dayWins++;
        });
        dailyBreakdown.push({ date: d, trades: dayTrades.length, pnl: dayPnl, wins: dayWins });
    });

    let wins = 0, sl = 0, totalPnl = 0, bigWins = 0;
    allTrades.forEach(t => {
        if (t.status.startsWith('PROFIT')) wins++;
        if (t.status === 'PROFIT_BIG') bigWins++;
        if (t.status === 'SL_HIT') sl++;
        totalPnl += t.finalGain;
    });

    return { allTrades, dailyBreakdown, total: allTrades.length, wins, bigWins, sl, totalPnl,
        winRate: wins / allTrades.length * 100,
        slRate: sl / allTrades.length * 100,
        avgPnl: totalPnl / allTrades.length,
        label
    };
}

// All Top 6 variants
const top6Variants = [
    { topN: 6, minTurnover: 500000,  sortBy: 'turnover', styleFilter: 'BOTH', minScore: undefined, label: 'Top6 | TO≥500K | Turnover | E+S' },
    { topN: 6, minTurnover: 750000,  sortBy: 'turnover', styleFilter: 'BOTH', minScore: undefined, label: 'Top6 | TO≥750K | Turnover | E+S' },
    { topN: 6, minTurnover: 1000000, sortBy: 'turnover', styleFilter: 'BOTH', minScore: undefined, label: 'Top6 | TO≥1.0M | Turnover | E+S' },
    { topN: 6, minTurnover: 1500000, sortBy: 'turnover', styleFilter: 'BOTH', minScore: undefined, label: 'Top6 | TO≥1.5M | Turnover | E+S' },
    { topN: 6, minTurnover: 750000,  sortBy: 'score',    styleFilter: 'BOTH', minScore: undefined, label: 'Top6 | TO≥750K | SmScore  | E+S' },
    { topN: 6, minTurnover: 1000000, sortBy: 'score',    styleFilter: 'BOTH', minScore: undefined, label: 'Top6 | TO≥1.0M | SmScore  | E+S' },
    { topN: 6, minTurnover: 750000,  sortBy: 'turnover', styleFilter: 'BOTH', minScore: 6,         label: 'Top6 | TO≥750K | Turnover | E+S | Sc≥6' },
    { topN: 6, minTurnover: 750000,  sortBy: 'turnover', styleFilter: 'BOTH', minScore: 7,         label: 'Top6 | TO≥750K | Turnover | E+S | Sc≥7' },
    { topN: 6, minTurnover: 750000,  sortBy: 'score',    styleFilter: 'BOTH', minScore: 7,         label: 'Top6 | TO≥750K | SmScore  | E+S | Sc≥7' },
    // Compare with Top 3 (current) and Top 5
    { topN: 3, minTurnover: 1500000, sortBy: 'score',    styleFilter: 'BOTH', minScore: undefined, label: 'Top3 | TO≥1.5M | SmScore  | E+S (SEKARANG)' },
    { topN: 5, minTurnover: 1500000, sortBy: 'score',    styleFilter: 'BOTH', minScore: undefined, label: 'Top5 | TO≥1.5M | SmScore  | E+S' },
];

console.log(`\n🔎 ANALISIS MENDALAM: SEMUA VARIASI TOP 6 vs TOP 3 & TOP 5`);
console.log(`📅 Tempoh: ${datesList[0]} hingga ${datesList[datesList.length-1]} (${datesList.length} hari dagangan)\n`);

console.log('='.repeat(130));
console.log('SOP'.padEnd(55) + '| Trades | Win%  | SL%  | BigWin | Avg PnL  | Total PnL');
console.log('-'.repeat(130));

const results = [];
top6Variants.forEach(v => {
    const r = runDetailed(v);
    results.push(r);
    const wr = r.winRate.toFixed(1).padStart(5) + '%';
    const slr = r.slRate.toFixed(1).padStart(4) + '%';
    const avg = (r.avgPnl >= 0 ? '+' : '') + r.avgPnl.toFixed(2) + '%';
    const tot = (r.totalPnl >= 0 ? '+' : '') + r.totalPnl.toFixed(1) + '%';
    console.log(`${r.label.padEnd(54)}| ${String(r.total).padStart(6)} | ${wr} | ${slr} | ${String(r.bigWins).padStart(6)} | ${avg.padStart(8)} | ${tot.padStart(9)}`);
});

// Detailed portfolio sim for the best Top 6
console.log('\n\n');
console.log('='.repeat(100));
console.log('💰 SIMULASI PORTFOLIO: Modal RM 5,000 & RM 10,000');
console.log('='.repeat(100));

[5000, 10000].forEach(capital => {
    console.log(`\n--- Modal: RM ${capital.toLocaleString()} ---`);
    console.log('SOP'.padEnd(55) + '| Untung Sebulan | ROI%');
    console.log('-'.repeat(90));

    results.forEach(r => {
        let totalProfit = 0;
        r.dailyBreakdown.forEach(day => {
            if (day.trades === 0) return;
            const capitalEach = capital / day.trades;
            // Re-calculate from individual trades for this day
            const dayTrades = r.allTrades.filter(t => t.date === day.date);
            dayTrades.forEach(t => {
                totalProfit += capitalEach * (t.finalGain / 100);
            });
        });

        const roi = (totalProfit / capital) * 100;
        console.log(`${r.label.padEnd(54)}| RM ${(totalProfit >= 0 ? '+' : '') + totalProfit.toFixed(0).padStart(6)} | ${(roi >= 0 ? '+' : '')}${roi.toFixed(1)}%`);
    });
});

// Daily breakdown for the best Top 6
const best = results.find(r => r.label.includes('Top6 | TO≥750K | Turnover | E+S') && !r.label.includes('Sc'));
if (best) {
    console.log('\n\n');
    console.log('='.repeat(90));
    console.log(`📅 PECAHAN HARIAN: ${best.label}`);
    console.log('='.repeat(90));
    console.log('Tarikh      | Posisi | Menang | PnL Hari  | Status');
    console.log('-'.repeat(90));

    let cumulPnl = 0;
    best.dailyBreakdown.forEach(day => {
        cumulPnl += day.pnl;
        const pnlStr = (day.pnl >= 0 ? '+' : '') + day.pnl.toFixed(2) + '%';
        const status = day.pnl > 0 ? '🟢 HIJAU' : day.pnl < 0 ? '🔴 MERAH' : '⚪ FLAT';
        console.log(`${day.date}  | ${String(day.trades).padStart(6)} | ${String(day.wins).padStart(6)} | ${pnlStr.padStart(9)} | ${status}`);
    });
    console.log('-'.repeat(90));
    console.log(`JUMLAH                                     ${(cumulPnl >= 0 ? '+' : '')}${cumulPnl.toFixed(2)}%`);
}
