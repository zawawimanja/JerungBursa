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

function testStrategy(minScore) {
    let totalTrades = 0;
    let wins = 0;
    let sl = 0;
    let totalPnl = 0;
    
    // Simulate day by day
    datesList.forEach((d, dateIdx) => {
        const dayRows = rows.filter(r => r.date === d && r.turnover >= 750000);
        const styles = ['EXPLOSIVE', 'STAIRCASE'];
        const dayPicks = [];
        
        // Sort candidates
        const sortFn = (a, b) => b.turnover - a.turnover;
        
        styles.forEach(style => {
            let candidates = dayRows.filter(r => r.style === style);
            candidates.sort(sortFn);
            candidates.slice(0, 6).forEach(t => dayPicks.push(t));
        });
        
        // Detect VVIP candidates based on yesterday's picks
        const prevPicks = [];
        if (dateIdx > 0) {
            const prevDate = datesList[dateIdx - 1];
            const prevDayRows = rows.filter(r => r.date === prevDate && r.turnover >= 750000);
            prevExps = prevDayRows.filter(r => r.style === 'EXPLOSIVE');
            prevStairs = prevDayRows.filter(r => r.style === 'STAIRCASE');
            prevExps.sort(sortFn);
            prevStairs.sort(sortFn);
            prevExps.slice(0, 6).forEach(t => prevPicks.push(t.name));
            prevStairs.slice(0, 6).forEach(t => prevPicks.push(t.name));
        }
        
        // Pick only VVIPs that also have Smart Score >= minScore
        dayPicks.forEach(p => {
            const isVvip = prevPicks.includes(p.name);
            const score = calculateSmartScore(p);
            
            const matchFilter = isVvip && (minScore === undefined || score >= minScore);
            if (matchFilter) {
                totalTrades++;
                totalPnl += p.finalGain;
                if (p.status.startsWith('PROFIT')) wins++;
                if (p.status === 'SL_HIT') sl++;
            }
        });
    });
    
    return {
        total: totalTrades,
        winRate: (wins / totalTrades) * 100,
        slRate: (sl / totalTrades) * 100,
        avgPnl: totalPnl / totalTrades,
        totalPnl
    };
}

console.log('📊 UJIAN STRATEGI GABUNGAN: VVIP + MINIMUM SMART SCORE (3 JUN - 1 JUL)');
console.log('='.repeat(90));
console.log('Strategi                       | Trades | Win Rate | SL Rate | Avg PnL | Total PnL');
console.log('-'.repeat(90));

const filters = [
    { label: 'Semua Kaunter VVIP (No filter)', minScore: undefined },
    { label: 'Kaunter VVIP + Smart Score >= 7', minScore: 7 },
    { label: 'Kaunter VVIP + Smart Score >= 8', minScore: 8 },
    { label: 'Kaunter VVIP + Smart Score >= 9', minScore: 9 },
    { label: 'Kaunter VVIP + Smart Score >= 10', minScore: 10 },
];

filters.forEach(f => {
    const r = testStrategy(f.minScore);
    const wr = r.winRate.toFixed(1).padStart(5) + '%';
    const slr = r.slRate.toFixed(1).padStart(5) + '%';
    const avg = (r.avgPnl >= 0 ? '+' : '') + r.avgPnl.toFixed(2) + '%';
    const tot = (r.totalPnl >= 0 ? '+' : '') + r.totalPnl.toFixed(1) + '%';
    console.log(`${f.label.padEnd(30)} | ${String(r.total).padStart(6)} | ${wr}  | ${slr}  | ${avg.padStart(7)} | ${tot.padStart(9)}`);
});
