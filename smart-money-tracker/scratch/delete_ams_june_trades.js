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

const fullData = eval(match[1]);
console.log(`Original trades in database: ${fullData.length}`);

// Filter out AMS trades in June 2026
const cleaned = fullData.filter(t => {
    const isAmsJune = t.name.toUpperCase().trim() === 'AMS' && t.date.startsWith('2026-06');
    return !isAmsJune;
});

console.log(`Cleaned trades in database: ${cleaned.length} (Deleted ${fullData.length - cleaned.length} false AMS June trades)`);

// Format back to array string
let arrayStr = 'const fullData = [\n';
cleaned.forEach((t, idx) => {
    const isLast = idx === cleaned.length - 1;
    const itemStr = `            { date: '${t.date}', name: '${t.name}', style: '${t.style}', entryPrice: ${t.entryPrice.toFixed(3)}, finalPrice: ${t.finalPrice.toFixed(3)}, maxGain: ${t.maxGain.toFixed(2)}, finalGain: ${t.finalGain.toFixed(2)}, status: '${t.status}', turnover: ${t.turnover}, pullback: ${t.pullback}, floorLow: ${t.floorLow}, touchCount: ${t.touchCount}, isConsolidation: ${t.isConsolidation}, sma50: ${t.sma50}, sma200: ${t.sma200}${t.isVvip ? ', isVvip: true' : ''} }`;
    arrayStr += itemStr + (isLast ? '' : ',\n');
});
arrayStr += '\n        ];';

// Replace in HTML
const newHtml = html.replace(/const\s+fullData\s*=\s*\[[\s\S]*?\];/s, arrayStr);

fs.writeFileSync(backtestFile, newHtml, 'utf8');
console.log("Successfully deleted June AMS trades and updated backtest.html!");
