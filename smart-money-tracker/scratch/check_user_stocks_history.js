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

const queryNames = ['KEEMING', 'HKB', 'SUM', 'MMCS', 'AMS', 'AMBEST', 'MNHLDG', 'ICENTS', 'DNEX'];

console.log("=== SEARCHING HISTORICAL RECORDS FOR USER STOCKS ===");

queryNames.forEach(name => {
    const trades = fullData.filter(t => t.name.toUpperCase().trim() === name);
    console.log(`\n📦 Stock: ${name} (${trades.length} trades found)`);
    if (trades.length > 0) {
        trades.forEach((t, i) => {
            const floor = t.floorLow || (t.entryPrice * 0.95);
            const dist = ((t.entryPrice - floor) / floor) * 100;
            let gain = t.finalGain;
            if (t.status === 'SL_HIT') gain = -3.00;
            
            console.log(`  [Trade #${i+1}] Date: ${t.date} | Entry: RM ${t.entryPrice.toFixed(3)} | Floor: RM ${floor.toFixed(3)} | DistToFloor: ${dist.toFixed(1)}% | Gain: ${gain >= 0 ? '+' : ''}${gain.toFixed(2)}% | Status: ${t.status}`);
        });
    } else {
        console.log("  No trades found in the current backtest database.");
    }
});
