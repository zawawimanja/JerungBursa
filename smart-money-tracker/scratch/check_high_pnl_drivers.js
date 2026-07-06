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

// Category Performance
const catStats = {
    'Fresh IPO (2025-2026)': { total: 0, profit: 0, totalGain: 0, maxWin: 0 },
    'Mature IPO (2019-2024)': { total: 0, profit: 0, totalGain: 0, maxWin: 0 },
    'Non-IPO (Pre-2019)': { total: 0, profit: 0, totalGain: 0, maxWin: 0 }
};

// Setup Style Performance
const styleStats = {
    'EXPLOSIVE': { total: 0, profit: 0, totalGain: 0, maxWin: 0 },
    'STAIRCASE': { total: 0, profit: 0, totalGain: 0, maxWin: 0 },
    'SWING PLAY': { total: 0, profit: 0, totalGain: 0, maxWin: 0 }
};

fullData.forEach(t => {
    const name = t.name.toUpperCase().trim();
    const ret = t.finalGain || 0;
    
    // Determine category
    const year = ipoYears[name];
    let cat = 'Non-IPO (Pre-2019)';
    if (year) {
        if (year >= 2025) cat = 'Fresh IPO (2025-2026)';
        else if (year >= 2019) cat = 'Mature IPO (2019-2024)';
    }
    
    catStats[cat].total++;
    if (ret > 0) catStats[cat].profit++;
    catStats[cat].totalGain += ret;
    if (ret > catStats[cat].maxWin) catStats[cat].maxWin = ret;
    
    // Determine style
    const style = t.style || 'SWING PLAY';
    if (styleStats[style]) {
        styleStats[style].total++;
        if (ret > 0) styleStats[style].profit++;
        styleStats[style].totalGain += ret;
        if (ret > styleStats[style].maxWin) styleStats[style].maxWin = ret;
    }
});

console.log("=== PNL ANALYSIS BY CATEGORY ===");
for (const [cat, stats] of Object.entries(catStats)) {
    const winRate = (stats.profit / stats.total) * 100;
    const avgReturn = stats.totalGain / stats.total;
    console.log(`- ${cat.padEnd(25)} | Trades: ${stats.total.toString().padEnd(3)} | Win Rate: ${winRate.toFixed(1)}% | Avg Return: +${avgReturn.toFixed(2)}% | Max Jackpot Win: +${stats.maxWin.toFixed(2)}%`);
}

console.log("\n=== PNL ANALYSIS BY SETUP STYLE ===");
for (const [style, stats] of Object.entries(styleStats)) {
    const winRate = (stats.profit / stats.total) * 100;
    const avgReturn = stats.totalGain / stats.total;
    console.log(`- ${style.padEnd(25)} | Trades: ${stats.total.toString().padEnd(3)} | Win Rate: ${winRate.toFixed(1)}% | Avg Return: +${avgReturn.toFixed(2)}% | Max Jackpot Win: +${stats.maxWin.toFixed(2)}%`);
}
