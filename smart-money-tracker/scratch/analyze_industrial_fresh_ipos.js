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

const targetNames = ['OGX', 'EIPOWER', 'PENTECH'];
const targetTrades = fullData.filter(t => targetNames.includes(t.name.toUpperCase().trim()));

console.log(`=== INDUSTRIAL FRESH IPO TRADES (EXCLUDING AMS) ===`);
console.log(`Total Trades Found: ${targetTrades.length}`);

targetTrades.forEach((t, i) => {
    let gain = t.finalGain;
    if (t.status === 'SL_HIT') gain = -3.00;
    
    // Calculate if it was bought near the peak or near floor
    const price = t.entryPrice;
    const floor = t.floorLow;
    const distToFloor = ((price - floor) / floor) * 100;
    
    console.log(`${t.name} | Date: ${t.date} | Entry: RM ${price.toFixed(3)} | Floor: RM ${floor.toFixed(3)} | DistToFloor: ${distToFloor.toFixed(1)}% | Gain: ${gain.toFixed(2)}% | Status: ${t.status} | Pullback: ${t.pullback}%`);
});
