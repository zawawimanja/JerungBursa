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

// Filter for AMS trades
const amsTrades = fullData.filter(t => t.name.toUpperCase().trim() === 'AMS');

console.log(`=== AMS HISTORICAL TRADES IN BACKTEST (${amsTrades.length} trades) ===`);
amsTrades.forEach((t, i) => {
    let gain = t.finalGain;
    if (t.status === 'SL_HIT') gain = -3.00;
    console.log(`Trade #${i+1}: Date: ${t.date} | Entry: RM ${t.entryPrice.toFixed(3)} | Close/Final: RM ${t.finalPrice.toFixed(3)} | Gain: ${gain.toFixed(2)}% | Status: ${t.status} | Pullback: ${t.pullback}% | Score: ${t.isVvip ? 'VVIP' : 'Normal'}`);
});
