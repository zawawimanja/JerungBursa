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

function analyzeDate(targetDate) {
    const dateIdx = datesList.indexOf(targetDate);
    if (dateIdx === -1) return;
    
    const dayRows = rows.filter(r => r.date === targetDate && r.turnover >= 750000);
    const styles = ['EXPLOSIVE', 'STAIRCASE'];
    const dayPicks = [];
    const sortFn = (a, b) => b.turnover - a.turnover;

    styles.forEach(style => {
        let candidates = dayRows.filter(r => r.style === style);
        candidates.sort(sortFn);
        candidates.slice(0, 6).forEach(t => dayPicks.push(t));
    });

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

    console.log(`\n📅 ANALISIS KAUNTER VVIP + SCORE >= 8 PADA TARIKH: ${targetDate}`);
    console.log('='.repeat(95));
    console.log('Nama       | Style     | Score | Entry    | Exit     | Max Gain | Final PnL | Status');
    console.log('-'.repeat(95));

    let matchedCount = 0;
    let totalPnl = 0;
    dayPicks.forEach(p => {
        const isVvip = prevPicks.includes(p.name);
        const score = calculateSmartScore(p);
        if (isVvip && score >= 8) {
            matchedCount++;
            totalPnl += p.finalGain;
            console.log(`${p.name.padEnd(10)} | ${p.style.padEnd(9)} | ${String(score).padStart(5)} | RM ${p.entryPrice.toFixed(3)} | RM ${p.finalPrice.toFixed(3)} | +${p.maxGain.toFixed(1).padStart(4)}% | ${(p.finalGain >= 0 ? '+' : '')}${p.finalGain.toFixed(1).padStart(5)}% | ${p.status}`);
        }
    });
    console.log('-'.repeat(95));
    if (matchedCount > 0) {
        console.log(`Purata PnL: +${(totalPnl / matchedCount).toFixed(2)}% | Jumlah Kaunter VVIP+Score>=8: ${matchedCount}`);
    } else {
        console.log(`Tiada kaunter VVIP dengan Score >= 8 pada tarikh ini.`);
    }
}

analyzeDate('2026-07-01');
