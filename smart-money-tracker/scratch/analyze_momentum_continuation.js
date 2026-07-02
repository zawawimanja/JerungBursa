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

// Let's analyze: If we buy a stock that rose on day T-1, how does it perform on day T?
// Wait, we can find stocks that appeared on consecutive days.
// Let's trace all occurrences of stocks.
const dates = [...new Set(rows.map(r => r.date))].sort();

let totalConsecutive = 0;
let consecutiveWins = 0;
let consecutiveSlHits = 0;
let totalConsecutiveGain = 0;

for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i-1];
    const currentDate = dates[i];
    
    const prevRows = rows.filter(r => r.date === prevDate);
    const currentRows = rows.filter(r => r.date === currentDate);
    
    // Find stocks present on both days
    prevRows.forEach(prevStock => {
        const matchingCurrent = currentRows.find(c => c.name === prevStock.name);
        if (matchingCurrent) {
            // This is a momentum continuation candidate (present yesterday and today)
            totalConsecutive++;
            totalConsecutiveGain += matchingCurrent.finalGain;
            if (matchingCurrent.status.startsWith('PROFIT')) consecutiveWins++;
            if (matchingCurrent.status === 'SL_HIT') consecutiveSlHits++;
        }
    });
}

console.log(`📊 ANALISIS MOMENTUM CONTINUATION (Beli kaunter yang semalam dah naik & hari ni masuk radar lagi)`);
console.log('='.repeat(90));
console.log(`Jumlah Trade Berterusan (Consecutive): ${totalConsecutive}`);
console.log(`Win Rate                            : ${(consecutiveWins/totalConsecutive*100).toFixed(1)}%`);
console.log(`SL Hit Rate                         : ${(consecutiveSlHits/totalConsecutive*100).toFixed(1)}%`);
console.log(`Purata PnL per Trade                : +${(totalConsecutiveGain/totalConsecutive).toFixed(2)}%`);
console.log(`Jumlah Kasar PnL                    : +${totalConsecutiveGain.toFixed(1)}%`);

// Let's check specific example: CHB
console.log('\n🔍 CONTOH TRACE KAUNTER: CHB');
console.log('='.repeat(90));
const chbRows = rows.filter(r => r.name === 'CHB').sort((a,b) => a.date.localeCompare(b.date));
chbRows.forEach(r => {
    console.log(`${r.date} | Entry Price: RM ${r.entryPrice.toFixed(3)} | Final Price: RM ${r.finalPrice.toFixed(3)} | Gain: ${(r.finalGain >= 0 ? '+' : '')}${r.finalGain.toFixed(2)}% | Status: ${r.status}`);
});

// Let's check specific example: MMCS
console.log('\n🔍 CONTOH TRACE KAUNTER: MMCS');
console.log('='.repeat(90));
const mmcsRows = rows.filter(r => r.name === 'MMCS').sort((a,b) => a.date.localeCompare(b.date));
mmcsRows.forEach(r => {
    console.log(`${r.date} | Entry Price: RM ${r.entryPrice.toFixed(3)} | Final Price: RM ${r.finalPrice.toFixed(3)} | Gain: ${(r.finalGain >= 0 ? '+' : '')}${r.finalGain.toFixed(2)}% | Status: ${r.status}`);
});
