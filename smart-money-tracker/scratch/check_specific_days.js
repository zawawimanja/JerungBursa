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

function getPicksForDate(targetDate) {
    const dayRows = rows.filter(r => r.date === targetDate && r.turnover >= 750000);
    const styles = ['EXPLOSIVE', 'STAIRCASE'];
    const picks = [];

    styles.forEach(style => {
        let candidates = dayRows.filter(r => r.style === style);
        // Sort by turnover descending
        candidates.sort((a, b) => b.turnover - a.turnover);
        candidates.slice(0, 6).forEach(t => picks.push(t));
    });
    return picks;
}

['2026-06-30', '2026-07-01'].forEach(d => {
    console.log(`\n📅 KAUNTER PILIHAN KEMASUKAN PADA: ${d}`);
    console.log('='.repeat(90));
    console.log('Nama       | Style     | Entry    | Exit     | Max Gain | Final PnL | Status | Turnover');
    console.log('-'.repeat(90));
    const picks = getPicksForDate(d);
    
    let totalPnl = 0;
    picks.forEach(p => {
        totalPnl += p.finalGain;
        const toM = (p.turnover / 1e6).toFixed(2) + 'M';
        console.log(`${p.name.padEnd(10)} | ${p.style.padEnd(9)} | RM ${p.entryPrice.toFixed(3)} | RM ${p.finalPrice.toFixed(3)} | +${p.maxGain.toFixed(1).padStart(4)}% | ${(p.finalGain >= 0 ? '+' : '')}${p.finalGain.toFixed(1).padStart(5)}% | ${p.status.padEnd(10)} | RM ${toM}`);
    });
    console.log('-'.repeat(90));
    const avg = totalPnl / picks.length;
    console.log(`Purata PnL Hari Ini: ${(avg >= 0 ? '+' : '')}${avg.toFixed(2)}% | Jumlah Kaunter: ${picks.length}`);
});
