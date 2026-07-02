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

function runStrategy({ topN, minTurnover, sortBy, styleFilter, minScore }) {
    const trades = [];
    datesList.forEach(d => {
        let dayRows = rows.filter(r => r.date === d && r.turnover >= minTurnover);

        const sortFn = sortBy === 'score'
            ? (a, b) => { const sd = calculateSmartScore(b) - calculateSmartScore(a); return sd !== 0 ? sd : b.turnover - a.turnover; }
            : (a, b) => b.turnover - a.turnover;

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

    if (trades.length < 10) return null; // Minimum 10 trades for statistical significance

    let wins = 0, sl = 0, totalPnl = 0;
    trades.forEach(t => {
        if (t.status.startsWith('PROFIT')) wins++;
        if (t.status === 'SL_HIT') sl++;
        totalPnl += t.finalGain;
    });

    return {
        total: trades.length,
        winRate: wins / trades.length * 100,
        slRate: sl / trades.length * 100,
        avgPnl: totalPnl / trades.length,
        totalPnl
    };
}

// GRID SEARCH: Exhaustive parameter sweep
const topNs = [1, 2, 3, 4, 5];
const minTurnovers = [500000, 750000, 1000000, 1500000, 2000000, 3000000, 5000000];
const sortBys = ['score', 'turnover'];
const styleFilters = ['BOTH', 'EXPLOSIVE_ONLY', 'STAIRCASE_ONLY'];
const minScores = [undefined, 6, 7, 8, 9, 10, 11];

let totalCombinations = 0;
const allResults = [];

for (const topN of topNs) {
    for (const minTurnover of minTurnovers) {
        for (const sortBy of sortBys) {
            for (const styleFilter of styleFilters) {
                for (const minScore of minScores) {
                    totalCombinations++;
                    const r = runStrategy({ topN, minTurnover, sortBy, styleFilter, minScore });
                    if (r) {
                        const turnoverLabel = minTurnover >= 1000000 
                            ? `${(minTurnover/1000000).toFixed(1)}M` 
                            : `${(minTurnover/1000).toFixed(0)}K`;
                        const label = `Top${topN} | TO≥${turnoverLabel} | ${sortBy === 'score' ? 'SmScore' : 'Turnvr'} | ${styleFilter === 'BOTH' ? 'E+S' : styleFilter === 'EXPLOSIVE_ONLY' ? 'E' : 'S'} | MinSc:${minScore ?? '-'}`;
                        allResults.push({ label, ...r, topN, minTurnover, sortBy, styleFilter, minScore });
                    }
                }
            }
        }
    }
}

console.log(`\n🔬 GRID SEARCH MENYELURUH - ${totalCombinations} KOMBINASI DIUJI`);
console.log(`📅 Tempoh: ${datesList[0]} hingga ${datesList[datesList.length-1]}`);
console.log(`✅ ${allResults.length} kombinasi valid (minimum 10 trade)\n`);

// Rank by different criteria
function printTop(title, sortFn, limit = 10) {
    const sorted = [...allResults].sort(sortFn);
    console.log(`\n${'='.repeat(120)}`);
    console.log(title);
    console.log(`${'='.repeat(120)}`);
    console.log('#  | SOP'.padEnd(60) + '| Trades | Win%  | SL%   | Avg PnL | Total PnL');
    console.log('-'.repeat(120));
    sorted.slice(0, limit).forEach((r, i) => {
        const wr = r.winRate.toFixed(1).padStart(5) + '%';
        const slr = r.slRate.toFixed(1).padStart(5) + '%';
        const avg = (r.avgPnl >= 0 ? '+' : '') + r.avgPnl.toFixed(2) + '%';
        const tot = (r.totalPnl >= 0 ? '+' : '') + r.totalPnl.toFixed(1) + '%';
        console.log(`${String(i+1).padStart(2)} | ${r.label.padEnd(57)}| ${String(r.total).padStart(6)} | ${wr} | ${slr} | ${avg.padStart(7)} | ${tot.padStart(9)}`);
    });
}

// Composite score: weighing PnL per trade, win rate, and low SL
function compositeScore(r) {
    // Normalize each metric to a 0-100 scale based on the dataset
    const maxAvgPnl = Math.max(...allResults.map(x => x.avgPnl));
    const maxWinRate = Math.max(...allResults.map(x => x.winRate));
    const minSlRate = Math.min(...allResults.map(x => x.slRate));
    const maxSlRate = Math.max(...allResults.map(x => x.slRate));

    const pnlScore = (r.avgPnl / maxAvgPnl) * 100;
    const wrScore = (r.winRate / maxWinRate) * 100;
    const slScore = maxSlRate > minSlRate ? ((maxSlRate - r.slRate) / (maxSlRate - minSlRate)) * 100 : 50;

    // Weighted composite: 40% PnL, 30% Win Rate, 30% Low SL
    return pnlScore * 0.40 + wrScore * 0.30 + slScore * 0.30;
}

printTop('🏆 TOP 10: PURATA PnL PER TRADE TERTINGGI (Kualiti Setiap Trade)', (a, b) => b.avgPnl - a.avgPnl);
printTop('💰 TOP 10: JUMLAH PnL TERKUMPUL TERTINGGI (Duit Paling Banyak)', (a, b) => b.totalPnl - a.totalPnl);
printTop('🎯 TOP 10: WIN RATE TERTINGGI (Paling Kerap Menang)', (a, b) => b.winRate - a.winRate);
printTop('🛡️ TOP 10: SL HIT RATE TERENDAH (Paling Selamat)', (a, b) => a.slRate - b.slRate);
printTop('⭐ TOP 10: SKOR KOMPOSIT TERBAIK (40% PnL + 30% WinRate + 30% Low SL)', (a, b) => compositeScore(b) - compositeScore(a));
