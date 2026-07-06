const fs = require('fs');
const path = require('path');

// Load backtest.html
const backtestFile = path.join(__dirname, '../backtest.html');
if (!fs.existsSync(backtestFile)) {
    console.error("backtest.html not found!");
    process.exit(1);
}

const html = fs.readFileSync(backtestFile, 'utf8');

// Extract fullData array
const match = html.match(/const\s+fullData\s*=\s*(\[[\s\S]*?\]);/);
if (!match) {
    console.error("Could not find fullData array!");
    process.exit(1);
}

const fullData = eval(match[1]);

const hofStocks = [
    'MNHLDG', 'KEEMING', 'HKB', 'AMBEST', 'CBHB', 'ICENTS', 'SUM', 'EIPOWER', 'OGX', 'MMCS'
];

console.log("=== CHECKING HALL OF FAME TRIGGERS IN JUN - JUL BACKTEST ===");
hofStocks.forEach(name => {
    const trades = fullData.filter(t => t.name.toUpperCase().trim() === name);
    console.log(`- Kaunter: ${name} | Triggered: ${trades.length} kali di bulan Jun`);
    if (trades.length > 0) {
        const dates = trades.map(t => t.date);
        console.log(`  Dates: ${dates.join(', ')}`);
    }
});
