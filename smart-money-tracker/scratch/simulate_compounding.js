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

function simulateCompounding({ topN, minTurnover, sortBy, styleFilter, minScore, startCapital, label }) {
    let capital = startCapital;
    const history = [];
    let totalTrades = 0, wins = 0, sl = 0;

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
            candidates.slice(0, topN).forEach(t => dayTrades.push(t));
        });

        if (dayTrades.length === 0) {
            history.push({ date: d, trades: 0, capital, pnl: 0, dailyReturn: 0 });
            return;
        }

        const capitalPerTrade = capital / dayTrades.length;
        let dayPnl = 0;

        dayTrades.forEach(t => {
            const profit = capitalPerTrade * (t.finalGain / 100);
            dayPnl += profit;
            totalTrades++;
            if (t.status.startsWith('PROFIT')) wins++;
            if (t.status === 'SL_HIT') sl++;
        });

        capital += dayPnl;
        const dailyReturn = (dayPnl / (capital - dayPnl)) * 100;
        history.push({ date: d, trades: dayTrades.length, capital, pnl: dayPnl, dailyReturn });
    });

    return { label, history, totalTrades, wins, sl, startCapital, endCapital: capital };
}

const strategies = [
    { topN: 3, minTurnover: 1500000, sortBy: 'score',    styleFilter: 'BOTH', minScore: undefined, label: 'Top3 SmartScore RM1.5M (SEKARANG)' },
    { topN: 5, minTurnover: 1500000, sortBy: 'score',    styleFilter: 'BOTH', minScore: undefined, label: 'Top5 SmartScore RM1.5M' },
    { topN: 6, minTurnover: 750000,  sortBy: 'turnover', styleFilter: 'BOTH', minScore: undefined, label: 'Top6 Turnover RM750K' },
    { topN: 6, minTurnover: 750000,  sortBy: 'turnover', styleFilter: 'BOTH', minScore: 7,         label: 'Top6 Turnover RM750K Score≥7' },
    { topN: 6, minTurnover: 750000,  sortBy: 'score',    styleFilter: 'BOTH', minScore: 7,         label: 'Top6 SmartScore RM750K Score≥7' },
    { topN: 7, minTurnover: 750000,  sortBy: 'turnover', styleFilter: 'BOTH', minScore: undefined, label: 'Top7 Turnover RM750K' },
];

const capitals = [3000, 5000, 10000, 20000, 50000];

capitals.forEach(startCap => {
    console.log('\n' + '='.repeat(120));
    console.log(`💰 SIMULASI COMPOUNDING — MODAL MULA: RM ${startCap.toLocaleString()}`);
    console.log(`📅 Tempoh: ${datesList[0]} hingga ${datesList[datesList.length-1]} (${datesList.length} hari dagangan / ~1 bulan)`);
    console.log('='.repeat(120));
    console.log('SOP'.padEnd(45) + '| Modal Mula | Modal Akhir | Untung Bersih | ROI%     | Trades | Win%');
    console.log('-'.repeat(120));

    strategies.forEach(s => {
        const r = simulateCompounding({ ...s, startCapital: startCap });
        const profit = r.endCapital - startCap;
        const roi = (profit / startCap) * 100;
        const wr = r.totalTrades > 0 ? (r.wins / r.totalTrades * 100).toFixed(1) : '0.0';
        
        console.log(`${r.label.padEnd(44)}| RM ${startCap.toLocaleString().padStart(7)} | RM ${r.endCapital.toFixed(0).padStart(7)} | RM ${(profit >= 0 ? '+' : '') + profit.toFixed(0).padStart(6)} | ${(roi >= 0 ? '+' : '')}${roi.toFixed(1).padStart(6)}% | ${String(r.totalTrades).padStart(6)} | ${wr}%`);
    });
});

// Detailed daily compounding log for the best strategy with RM 5K
console.log('\n\n');
console.log('='.repeat(100));
console.log('📅 LOG HARIAN COMPOUNDING: Top6 Turnover RM750K Score≥7 (Modal RM 5,000)');
console.log('='.repeat(100));

const bestSim = simulateCompounding({ topN: 6, minTurnover: 750000, sortBy: 'turnover', styleFilter: 'BOTH', minScore: 7, startCapital: 5000, label: 'Top6 Turnover RM750K Score≥7' });

console.log('Tarikh      | Posisi | Modal Pagi    | PnL Hari      | Modal Petang   | Status');
console.log('-'.repeat(100));

bestSim.history.forEach(h => {
    const capitalBefore = h.capital - h.pnl;
    const pnlStr = h.pnl >= 0 ? `+RM ${h.pnl.toFixed(0)}` : `-RM ${Math.abs(h.pnl).toFixed(0)}`;
    const status = h.pnl > 0 ? '🟢' : h.pnl < 0 ? '🔴' : '⚪';
    console.log(`${h.date}  | ${String(h.trades).padStart(6)} | RM ${capitalBefore.toFixed(0).padStart(8)} | ${pnlStr.padStart(13)} | RM ${h.capital.toFixed(0).padStart(8)} | ${status}`);
});

console.log('-'.repeat(100));
console.log(`MULA: RM ${bestSim.startCapital.toLocaleString()}  →  AKHIR: RM ${bestSim.endCapital.toFixed(0)}  →  UNTUNG: RM +${(bestSim.endCapital - bestSim.startCapital).toFixed(0)}  (ROI: +${((bestSim.endCapital - bestSim.startCapital) / bestSim.startCapital * 100).toFixed(1)}%)`);

// Annualized projection
console.log('\n');
console.log('='.repeat(100));
console.log('📈 UNJURAN SETAHUN (Compounding Bulanan)');
console.log('='.repeat(100));

capitals.forEach(startCap => {
    // Use the best strategy's monthly ROI to project
    const bestResult = simulateCompounding({ topN: 6, minTurnover: 750000, sortBy: 'turnover', styleFilter: 'BOTH', minScore: 7, startCapital: startCap, label: '' });
    const monthlyRoi = (bestResult.endCapital - startCap) / startCap;
    
    let projected = startCap;
    console.log(`\nModal Mula: RM ${startCap.toLocaleString()} (Monthly ROI: +${(monthlyRoi * 100).toFixed(1)}%)`);
    console.log('Bulan | Modal');
    for (let m = 1; m <= 12; m++) {
        projected *= (1 + monthlyRoi);
        console.log(`  ${String(m).padStart(2)}  | RM ${projected.toFixed(0).padStart(10)}`);
    }
    console.log(`  SETAHUN: RM ${startCap.toLocaleString()} → RM ${projected.toFixed(0)} (+${((projected - startCap) / startCap * 100).toFixed(0)}%)`);
});
