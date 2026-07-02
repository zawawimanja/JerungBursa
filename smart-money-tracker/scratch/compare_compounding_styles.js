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

function simulateStyle(type) {
    let capital = 5000;
    let totalTrades = 0;
    let wins = 0;
    let sl = 0;
    
    datesList.forEach((d, dateIdx) => {
        const dayRows = rows.filter(r => r.date === d && r.turnover >= 750000);
        const styles = ['EXPLOSIVE', 'STAIRCASE'];
        const dayPicks = [];
        const sortFn = (a, b) => b.turnover - a.turnover;

        styles.forEach(style => {
            let candidates = dayRows.filter(r => r.style === style);
            candidates.sort(sortFn);
            candidates.slice(0, 6).forEach(t => dayPicks.push(t));
        });

        // Detect VVIPs
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

        // Filter daily picks based on style type
        let selectedPicks = [];
        if (type === 'ALL_TOP6') {
            selectedPicks = dayPicks;
        } else if (type === 'VVIP_SCORE8') {
            selectedPicks = dayPicks.filter(p => prevPicks.includes(p.name) && calculateSmartScore(p) >= 8);
        }

        if (selectedPicks.length === 0) return;

        const capitalPerTrade = capital / selectedPicks.length;
        let dayPnl = 0;
        
        selectedPicks.forEach(p => {
            dayPnl += capitalPerTrade * (p.finalGain / 100);
            totalTrades++;
            if (p.status.startsWith('PROFIT')) wins++;
            if (p.status === 'SL_HIT') sl++;
        });
        capital += dayPnl;
    });

    return { capital, totalTrades, wins, sl };
}

const r1 = simulateStyle('ALL_TOP6');
const r2 = simulateStyle('VVIP_SCORE8');

console.log('📊 PERBANDINGAN GAYA COMPOUNDING SEBULAN PENUH (MODAL MULA: RM 5,000)');
console.log('='.repeat(95));
console.log(`1. GAYA PEMBURU (Top 6 Turnover - Tangkap kaunter meletup):`);
console.log(`   - Modal Akhir : RM ${r1.capital.toFixed(0)}`);
console.log(`   - Untung      : RM +${(r1.capital - 5000).toFixed(0)} (+${((r1.capital - 5000)/5000*100).toFixed(1)}% ROI)`);
console.log(`   - Total Trade : ${r1.totalTrades} | Win Rate: ${(r1.wins/r1.totalTrades*100).toFixed(1)}% | SL Hit: ${(r1.sl/r1.totalTrades*100).toFixed(1)}%`);
console.log(``);
console.log(`2. GAYA ANTI-SL (VVIP + Score >= 8 - Fokus selamat):`);
console.log(`   - Modal Akhir : RM ${r2.capital.toFixed(0)}`);
console.log(`   - Untung      : RM +${(r2.capital - 5000).toFixed(0)} (+${((r2.capital - 5000)/5000*100).toFixed(1)}% ROI)`);
console.log(`   - Total Trade : ${r2.totalTrades} | Win Rate: ${(r2.wins/r2.totalTrades*100).toFixed(1)}% | SL Hit: ${(r2.sl/r2.totalTrades*100).toFixed(1)}%`);
