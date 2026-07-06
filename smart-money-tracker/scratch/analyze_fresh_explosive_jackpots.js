const fs = require('fs');
const path = require('path');

// Load data and trades
const backtestFile = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(backtestFile, 'utf8');

const startIdx = content.indexOf('const fullData = [');
const endIdx = content.indexOf('];', startIdx);
const arrayString = content.substring(startIdx + 17, endIdx + 1);
const fullData = eval(arrayString);

// Load IPO list to categorize correctly
const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const ipos = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));
const ipoYears = {};
ipos.forEach(ipo => {
    const sym = ipo.symbol ? ipo.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim() : '';
    const name = ipo.companyName ? ipo.companyName.replace(/\[.*?\]/g, '').toUpperCase().trim() : '';
    const year = parseInt(ipo.year) || (ipo.listingDate ? parseInt(ipo.listingDate.split('-')[2]) : 0);
    if (sym) ipoYears[sym] = year;
    if (name) ipoYears[name] = year;
});

// Filter for Fresh Explosive Trades
const freshExplosiveTrades = [];

fullData.forEach(t => {
    const name = t.name.toUpperCase().trim();
    const year = ipoYears[name];
    
    const isFresh = year && year >= 2025;
    const isExplosive = (t.style === 'EXPLOSIVE');
    
    if (isFresh && isExplosive) {
        freshExplosiveTrades.push(t);
    }
});

// Sort by finalGain descending
freshExplosiveTrades.sort((a, b) => b.finalGain - a.finalGain);

console.log("=== RANKING SAHAM FRESH EXPLOSIVE PALING UNTUNG (BACKTEST) ===");
console.log(`Jumlah Trade Fresh Explosive Temui: ${freshExplosiveTrades.length}\n`);

freshExplosiveTrades.forEach((t, idx) => {
    const sign = t.finalGain >= 0 ? '+' : '';
    console.log(`${(idx + 1).toString().padEnd(2)} | Date: ${t.date} | Stock: ${t.name.padEnd(8)} | Entry: RM ${t.entryPrice.toFixed(3)} | Exit: RM ${t.finalPrice.toFixed(3)} | Gain: ${sign}${t.finalGain.toFixed(2)}% | Max Gain: +${t.maxGain.toFixed(2)}% | Status: ${t.status}`);
});
