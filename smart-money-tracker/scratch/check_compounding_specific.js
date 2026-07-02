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
        candidates.sort((a, b) => b.turnover - a.turnover);
        candidates.slice(0, 6).forEach(t => picks.push(t));
    });
    return picks;
}

const p30 = getPicksForDate('2026-06-30');
const p01 = getPicksForDate('2026-07-01');

// Simple sum of percentages
let sum30 = 0, sum01 = 0;
p30.forEach(p => sum30 += p.finalGain);
p01.forEach(p => sum01 += p.finalGain);

// Compounding simulation starting June 30th
let capital = 5000;

// June 30th
let cap30Before = capital;
let capPerTrade30 = capital / p30.length;
let pnl30 = 0;
p30.forEach(p => {
    pnl30 += capPerTrade30 * (p.finalGain / 100);
});
capital += pnl30;
let cap30After = capital;

// July 1st
let cap01Before = capital;
let capPerTrade01 = capital / p01.length;
let pnl01 = 0;
p01.forEach(p => {
    pnl01 += capPerTrade01 * (p.finalGain / 100);
});
capital += pnl01;
let cap01After = capital;

console.log(`📊 STATISTIK 30 JUN - 1 JUL`);
console.log(`=========================================`);
console.log(`1. Jumlah PnL Kasar (Sum of PnL%):`);
console.log(`   - 30 Jun : +${sum30.toFixed(2)}%`);
console.log(`   - 01 Jul : ${sum01.toFixed(2)}%`);
console.log(`   - Jumlah  : +${(sum30 + sum01).toFixed(2)}%`);
console.log(``);
console.log(`2. Simulasi Compounding (Modal RM 5,000):`);
console.log(`   - 30 Jun Mula  : RM ${cap30Before.toFixed(0)}`);
console.log(`   - 30 Jun Untung: RM +${pnl30.toFixed(0)} (+${((pnl30/cap30Before)*100).toFixed(1)}%)`);
console.log(`   - 30 Jun Akhir : RM ${cap30After.toFixed(0)}`);
console.log(`   - 01 Jul Mula  : RM ${cap01Before.toFixed(0)}`);
console.log(`   - 01 Jul Untung: RM ${pnl01.toFixed(0)} (${((pnl01/cap01Before)*100).toFixed(1)}%)`);
console.log(`   - 01 Jul Akhir : RM ${cap01After.toFixed(0)}`);
console.log(``);
console.log(`   - Total Untung : RM +${(capital - 5000).toFixed(0)}`);
console.log(`   - Total ROI    : +${(((capital - 5000)/5000)*100).toFixed(1)}%`);
