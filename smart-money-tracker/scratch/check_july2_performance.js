const fs = require('fs');
const path = require('path');

const liveDataPath = path.join(__dirname, '../live_data.json');
const liveData = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const currentList = liveData.topVolume || [];

// Yesterday's picks (1/7):
const yesterdayPicks = [
    { name: 'DNEX', entryPrice: 0.450, score: 8, style: 'EXPLOSIVE', isVvip: true },
    { name: 'SLVEST', entryPrice: 3.160, score: 7, style: 'EXPLOSIVE', isVvip: false },
    { name: 'SUM', entryPrice: 0.535, score: 8, style: 'EXPLOSIVE', isVvip: true },
    { name: 'OPPSTAR', entryPrice: 0.655, score: 7, style: 'EXPLOSIVE', isVvip: false },
    { name: 'CHB', entryPrice: 1.410, score: 9, style: 'EXPLOSIVE', isVvip: true },
    { name: 'PEKAT', entryPrice: 1.800, score: 7, style: 'EXPLOSIVE', isVvip: false },
    { name: 'GREATEC', entryPrice: 2.660, score: 11, style: 'STAIRCASE', isVvip: true },
    { name: 'DUFU', entryPrice: 2.450, score: 9, style: 'STAIRCASE', isVvip: false },
    { name: 'JPG', entryPrice: 1.790, score: 13, style: 'STAIRCASE', isVvip: true },
    { name: 'MNHLDG', entryPrice: 2.920, score: 11, style: 'STAIRCASE', isVvip: true },
    { name: 'CBHB', entryPrice: 0.685, score: 8, style: 'STAIRCASE', isVvip: true },
    { name: 'EIPOWER', entryPrice: 0.685, score: 6, style: 'STAIRCASE', isVvip: false }
];

console.log('📊 PRESTASI KAUNTER KEMASUKAN 1/7 PADA HARI INI (2/7):');
console.log('='.repeat(95));
console.log('Nama       | Score | VVIP? | Entry    | Semasa   | Hasil PnL% | Status Semasa');
console.log('-'.repeat(95));

yesterdayPicks.forEach(p => {
    const liveStock = currentList.find(c => c.name === p.name);
    if (liveStock) {
        const pnl = ((liveStock.price - p.entryPrice) / p.entryPrice) * 100;
        const sign = pnl >= 0 ? '+' : '';
        const status = pnl > 0 ? 'UNTUNG 🟢' : pnl < 0 ? 'RUGI 🔴' : 'FLAT ⚪';
        console.log(`${p.name.padEnd(10)} | ${String(p.score).padStart(5)} | ${p.isVvip ? 'YA   ' : 'TIDAK'} | RM ${p.entryPrice.toFixed(3)} | RM ${liveStock.price.toFixed(3)} | ${sign}${pnl.toFixed(2).padStart(5)}% | ${status}`);
    } else {
        console.log(`${p.name.padEnd(10)} | ${String(p.score).padStart(5)} | ${p.isVvip ? 'YA   ' : 'TIDAK'} | RM ${p.entryPrice.toFixed(3)} | N/A       | N/A        | Tiada dalam data live`);
    }
});
