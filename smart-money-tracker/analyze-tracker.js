const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'tracker_data.js');
if (!fs.existsSync(file)) {
  console.error("tracker_data.js not found");
  process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');
// Extract JSON payload
const jsonStr = content.replace('window.TRACKER_DATA = ', '').replace(/;$/, '');
const data = JSON.parse(jsonStr);

console.log(`=== ANALISIS MATRIKS TRACKER BAWAH RM 1.00 (${data.length} REKOD) ===\n`);

// 1. Top Performers (Max Gain in 10 Days)
const performers = [];
data.forEach(tr => {
  const validDiffs = tr.diffs.filter(d => typeof d === 'number');
  if (validDiffs.length === 0) return;
  const maxGain = Math.max(...validDiffs);
  const finalGain = validDiffs[validDiffs.length - 1];
  performers.push({
    name: tr.name,
    date: tr.date,
    triggerPrice: tr.triggerPrice,
    setup: tr.setup,
    maxGain,
    finalGain,
    currentDiff: tr.currentDiff
  });
});

performers.sort((a, b) => b.maxGain - a.maxGain);
console.log("🔥 TOP 10 RALI TERBESAR (MAX GAIN KELAS 10 HARI):");
performers.slice(0, 10).forEach((p, idx) => {
  console.log(`${idx+1}. ${p.name} (${p.date}) [${p.setup}] - Trigger: RM ${p.triggerPrice.toFixed(3)} -> Max Naik: +${p.maxGain}% (P&L Semasa: ${p.currentDiff >= 0 ? '+' : ''}${p.currentDiff}%)`);
});

// 2. Setup Type Performance Comparison
const setupStats = {};
data.forEach(tr => {
  const validDiffs = tr.diffs.filter(d => typeof d === 'number');
  if (validDiffs.length === 0) return;
  const setup = tr.setup;
  if (!setupStats[setup]) {
    setupStats[setup] = { count: 0, winCount: 0, totalMaxGain: 0, totalFinalGain: 0 };
  }
  
  const maxGain = Math.max(...validDiffs);
  const finalGain = validDiffs[validDiffs.length - 1];
  
  setupStats[setup].count++;
  if (finalGain > 0) {
    setupStats[setup].winCount++;
  }
  setupStats[setup].totalMaxGain += maxGain;
  setupStats[setup].totalFinalGain += finalGain;
});

console.log("\n📊 PERBANDINGAN STRATEGI SETUP (PURATA PRESTASI):");
Object.keys(setupStats).forEach(setup => {
  const stats = setupStats[setup];
  const winRate = ((stats.winCount / stats.count) * 100).toFixed(1);
  const avgMax = (stats.totalMaxGain / stats.count).toFixed(1);
  const avgFinal = (stats.totalFinalGain / stats.count).toFixed(1);
  console.log(`- [${setup}] (Jumlah: ${stats.count} trade) | Win Rate: ${winRate}% | Purata Max Gain: +${avgMax}% | Purata Akhir Day 10: ${avgFinal >= 0 ? '+' : ''}${avgFinal}%`);
});

// 3. Current Active Winners (Highest Current P&L)
const activeWinners = data
  .filter(tr => tr.currentDiff !== null)
  .sort((a, b) => b.currentDiff - a.currentDiff);

console.log("\n🏆 TOP 5 SAHAM PEMENANG AKTIF HARI INI (CURRENT P&L TERTINGGI):");
activeWinners.slice(0, 5).forEach((p, idx) => {
  console.log(`${idx+1}. ${p.name} (Trigger: ${p.date}) [${p.setup}] | Trigger Price: RM ${p.triggerPrice.toFixed(3)} -> Harga Semasa: RM ${p.currentPrice.toFixed(3)} | P&L Semasa: +${p.currentDiff}%`);
});
