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

console.log(`📊 STATISTIK DATASET BACKTEST.HTML:`);
console.log(`==================================`);
console.log(`Jumlah Rekod Mentah: ${rows.length}`);

const dates = [...new Set(rows.map(r => r.date))].sort();
console.log(`Tarikh Awal        : ${dates[0]}`);
console.log(`Tarikh Akhir       : ${dates[dates.length - 1]}`);
console.log(`Jumlah Hari Dagang : ${dates.length} hari`);

// Group by stock name
const stocks = [...new Set(rows.map(r => r.name))];
console.log(`Jumlah Saham Unik  : ${stocks.length} kaunter`);

// Let's print some sample rows
console.log(`\nContoh 3 rekod teratas:`);
rows.slice(0, 3).forEach(r => console.log(JSON.stringify(r)));
