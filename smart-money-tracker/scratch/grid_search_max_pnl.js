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

        const stylesToRun = styleFilter === 'BOTH' ? ['EXPLOSIVE', 'STAIRCASE']
            : styleFilter === 'EXPLOSIVE_ONLY' ? ['EXPLOSIVE']
            : ['STAIRCASE'];

        stylesToRun.forEach(style => {
            let candidates = dayRows.filter(r => r.style === style);
            candidates.sort(sortFn);
            if (minScore !== undefined) {
                candidates = candidates.filter(r => calculateSmartScore(r) >= minScore);
            }
            const limit = topN === 99 ? candidates.length : topN; // 99 = unlimited
            candidates.slice(0, limit).forEach(t => trades.push(t));
        });
    });

    if (trades.length < 10) return null;

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
        totalPnl,
        tradesPerDay: trades.length / datesList.length
    };
}

// Extended grid - focus on maximizing total PnL
const topNs = [1, 2, 3, 4, 5, 6, 7, 8, 10, 99]; // 99 = ALL (unlimited)
const minTurnovers = [500000, 750000, 1000000, 1500000, 2000000, 3000000, 5000000];
const sortBys = ['score', 'turnover'];
const styleFilters = ['BOTH', 'EXPLOSIVE_ONLY'];
const minScores = [undefined, 6, 7, 8, 9];

const allResults = [];
let totalCombinations = 0;

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
                        const topLabel = topN === 99 ? 'ALL' : `Top${topN}`;
                        const label = `${topLabel} | TO≥${turnoverLabel} | ${sortBy === 'score' ? 'SmScore' : 'Turnvr'} | ${styleFilter === 'BOTH' ? 'E+S' : 'E'} | MinSc:${minScore ?? '-'}`;
                        allResults.push({ label, ...r, topN, minTurnover, sortBy, styleFilter, minScore });
                    }
                }
            }
        }
    }
}

console.log(`\n🔬 GRID SEARCH FOKUS PnL MAKSIMUM — ${totalCombinations} KOMBINASI DIUJI`);
console.log(`📅 Tempoh: ${datesList[0]} hingga ${datesList[datesList.length-1]} (${datesList.length} hari dagangan)`);
console.log(`✅ ${allResults.length} kombinasi valid (minimum 10 trade)\n`);

// Sort by TOTAL PnL
allResults.sort((a, b) => b.totalPnl - a.totalPnl);

console.log('='.repeat(130));
console.log('💰 TOP 25 SOP PALING BANYAK BUAT DUIT (JUMLAH PnL TERKUMPUL)');
console.log('='.repeat(130));
console.log('#  | SOP'.padEnd(62) + '| Trades | /Day | Win%  | SL%   | Avg PnL  | TOTAL PnL');
console.log('-'.repeat(130));
allResults.slice(0, 25).forEach((r, i) => {
    const wr = r.winRate.toFixed(1).padStart(5) + '%';
    const slr = r.slRate.toFixed(1).padStart(5) + '%';
    const avg = (r.avgPnl >= 0 ? '+' : '') + r.avgPnl.toFixed(2) + '%';
    const tot = (r.totalPnl >= 0 ? '+' : '') + r.totalPnl.toFixed(1) + '%';
    const perDay = r.tradesPerDay.toFixed(1);
    const marker = i === 0 ? ' 👑' : '';
    console.log(`${String(i+1).padStart(2)} | ${r.label.padEnd(58)}| ${String(r.total).padStart(6)} | ${perDay.padStart(4)} | ${wr} | ${slr} | ${avg.padStart(8)} | ${tot.padStart(9)}${marker}`);
});

// Also show: for a fixed capital (e.g. RM 10K split equally per trade per day)
// What's the actual portfolio return?
console.log('\n');
console.log('='.repeat(130));
console.log('📊 SIMULASI PULANGAN PORTFOLIO SEBENAR (Modal RM 10,000 dibahagi sama rata per posisi setiap hari)');
console.log('='.repeat(130));

// Re-run top strategies with portfolio simulation
const topStrategies = allResults.slice(0, 15);

console.log('#  | SOP'.padEnd(62) + '| Posisi/Hari | Modal/Posisi | PnL Sebulan | ROI%');
console.log('-'.repeat(130));

topStrategies.forEach((s, i) => {
    const posPerDay = s.tradesPerDay;
    const capitalPerPos = 10000 / Math.max(posPerDay, 1);
    
    // Simulate day by day
    let totalProfit = 0;
    const trades = [];
    
    // Re-run to get individual trades
    datesList.forEach(d => {
        let dayRows = rows.filter(r => r.date === d && r.turnover >= s.minTurnover);
        const sortFn = s.sortBy === 'score'
            ? (a, b) => { const sd = calculateSmartScore(b) - calculateSmartScore(a); return sd !== 0 ? sd : b.turnover - a.turnover; }
            : (a, b) => b.turnover - a.turnover;

        const stylesToRun = s.styleFilter === 'BOTH' ? ['EXPLOSIVE', 'STAIRCASE'] : ['EXPLOSIVE'];

        const dayTrades = [];
        stylesToRun.forEach(style => {
            let candidates = dayRows.filter(r => r.style === style);
            candidates.sort(sortFn);
            if (s.minScore !== undefined) {
                candidates = candidates.filter(r => calculateSmartScore(r) >= s.minScore);
            }
            const limit = s.topN === 99 ? candidates.length : s.topN;
            candidates.slice(0, limit).forEach(t => dayTrades.push(t));
        });

        if (dayTrades.length > 0) {
            const capitalEach = 10000 / dayTrades.length;
            dayTrades.forEach(t => {
                totalProfit += capitalEach * (t.finalGain / 100);
            });
        }
    });

    const roi = (totalProfit / 10000) * 100;
    const posStr = posPerDay.toFixed(1);
    const capStr = `RM ${(10000 / Math.max(Math.round(posPerDay), 1)).toLocaleString()}`;
    const pnlStr = `RM ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)}`;
    const roiStr = `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`;
    const marker = i === 0 ? ' 👑' : '';
    
    console.log(`${String(i+1).padStart(2)} | ${s.label.padEnd(58)}| ${posStr.padStart(11)} | ${capStr.padStart(13)} | ${pnlStr.padStart(11)} | ${roiStr.padStart(6)}${marker}`);
});
