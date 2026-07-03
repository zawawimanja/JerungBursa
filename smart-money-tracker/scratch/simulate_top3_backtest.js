const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');
if (!fs.existsSync(filePath)) {
    console.error("❌ backtest.html not found!");
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const match = content.match(/const fullData = \[\s*([\s\S]*?)\s*\];/);
if (!match) {
    console.error("❌ Could not find fullData in backtest.html");
    process.exit(1);
}

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

console.log(`=====================================================================`);
console.log(`🔬 SIMULASI DIVERSIFIKASI PORTFOLIO: BELI SEMUA vs BELI TOP 3`);
console.log(`📅 Tempoh Ujian: ${datesList[0]} hingga ${datesList[datesList.length-1]}`);
console.log(`=====================================================================`);

// 1. ALL TRADES STATS (Beli Semua yang lepas tapisan)
let allCount = 0;
let allWins = 0;
let allSL = 0;
let allPnlSum = 0;

rows.forEach(r => {
    // Basic filter
    if (r.turnover >= 750000 && calculateSmartScore(r) >= 8) {
        allCount++;
        allPnlSum += r.finalGain;
        if (r.finalGain > 0) allWins++;
        if (r.status === 'SL_HIT') allSL++;
    }
});

const allAvg = allPnlSum / allCount;
const allWinRate = (allWins / allCount) * 100;
const allSLRate = (allSL / allCount) * 100;

// 2. TOP 3 TRADES STATS (Beli hanya Top 3 kaunter paling tinggi skor setiap hari)
let top3Count = 0;
let top3Wins = 0;
let top3SL = 0;
let top3PnlSum = 0;
const top3Details = [];

datesList.forEach(d => {
    // Filter candidates for this day
    let candidates = rows.filter(r => r.date === d && r.turnover >= 750000 && calculateSmartScore(r) >= 8);
    
    // Sort by Smart Score descending, then turnover descending
    candidates.sort((a, b) => {
        const scoreDiff = calculateSmartScore(b) - calculateSmartScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return b.turnover - a.turnover;
    });

    // Take only the Top 3
    const top3Day = candidates.slice(0, 3);
    top3Day.forEach(r => {
        top3Count++;
        top3PnlSum += r.finalGain;
        if (r.finalGain > 0) top3Wins++;
        if (r.status === 'SL_HIT') top3SL++;
        top3Details.push(r);
    });
});

const top3Avg = top3PnlSum / top3Count;
const top3WinRate = (top3Wins / top3Count) * 100;
const top3SLRate = (top3SL / top3Count) * 100;

console.log(`\n📊 KEPUTUSAN PERBANDINGAN:`);
console.log(`---------------------------------------------------------------------`);
console.log(`METRIK                       | BELI SEMUA SAHAM      | BELI TOP 3 SAHAM SAHAJA`);
console.log(`---------------------------------------------------------------------`);
console.log(`Jumlah Transaksi (Trades)    | ${String(allCount).padEnd(21)} | ${String(top3Count).padEnd(23)}`);
console.log(`Kadar Menang (Win Rate)      | ${allWinRate.toFixed(1).padStart(5)}%                 | ${top3WinRate.toFixed(1).padStart(5)}%`);
console.log(`Kadar Cut Loss (SL Hit Rate) | ${allSLRate.toFixed(1).padStart(5)}%                 | ${top3SLRate.toFixed(1).padStart(5)}%`);
console.log(`Purata PnL (Per Trade)       | ${allAvg >= 0 ? '+' : ''}${allAvg.toFixed(2).padStart(5)}%                 | ${top3Avg >= 0 ? '+' : ''}${top3Avg.toFixed(2).padStart(5)}%`);
console.log(`Kumulatif PnL (Hasil Tambah) | ${allPnlSum >= 0 ? '+' : ''}${allPnlSum.toFixed(1).padStart(5)}%                 | ${top3PnlSum >= 0 ? '+' : ''}${top3PnlSum.toFixed(1).padStart(5)}%`);
console.log(`---------------------------------------------------------------------`);

console.log(`\n💡 ANALISIS IMPLIKASI:`);
console.log(`- Apabila kita beli TOP 3 sahaja, kadar kemenangan (Win Rate) meningkat daripada ${allWinRate.toFixed(1)}% ke ${top3WinRate.toFixed(1)}%!`);
console.log(`- Purata keuntungan per trade juga meningkat daripada ${allAvg.toFixed(2)}% ke ${top3Avg.toFixed(2)}% kerana kita hanya fokus kepada setup berkualiti tinggi sahaja.`);
console.log(`- Kumulatif PnL untuk Top 3 tetap sangat tinggi iaitu ${top3PnlSum >= 0 ? '+' : ''}${top3PnlSum.toFixed(1)}% dengan jumlah trade yang jauh lebih praktikal (${top3Count} trade vs ${allCount} trade).`);
console.log(`=====================================================================\n`);
