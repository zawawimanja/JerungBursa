const fs = require('fs');
const path = require('path');

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

// Safely parse
const fullData = eval(match[1]);
console.log(`Original trade count: ${fullData.length}`);

// Filter trades: distToFloor <= 15%
const filtered = fullData.filter(t => {
    const floor = t.floorLow || (t.entryPrice * 0.95);
    const dist = ((t.entryPrice - floor) / floor) * 100;
    return dist <= 15.0;
});

console.log(`Filtered trade count: ${filtered.length} (Removed ${fullData.length - filtered.length} trades with distToFloor > 15.0%)`);

// Format back to array string
let arrayStr = 'const fullData = [\n';
filtered.forEach((t, idx) => {
    const isLast = idx === filtered.length - 1;
    // Construct single line trade object representation
    const itemStr = `            { date: '${t.date}', name: '${t.name}', style: '${t.style}', entryPrice: ${t.entryPrice.toFixed(3)}, finalPrice: ${t.finalPrice.toFixed(3)}, maxGain: ${t.maxGain.toFixed(2)}, finalGain: ${t.finalGain.toFixed(2)}, status: '${t.status}', turnover: ${t.turnover}, pullback: ${t.pullback}, floorLow: ${t.floorLow}, touchCount: ${t.touchCount}, isConsolidation: ${t.isConsolidation}, sma50: ${t.sma50}, sma200: ${t.sma200}${t.isVvip ? ', isVvip: true' : ''} }`;
    arrayStr += itemStr + (isLast ? '' : ',\n');
});
arrayStr += '\n        ];';

// Replace in HTML
const newHtml = html.replace(/const\s+fullData\s*=\s*\[[\s\S]*?\];/s, arrayStr);

fs.writeFileSync(backtestFile, newHtml, 'utf8');
console.log("Successfully rebuilt and saved backtest.html with clean <= 15.0% floor-distance database!");
