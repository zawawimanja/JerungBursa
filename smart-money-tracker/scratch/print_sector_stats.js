const fs = require('fs');
const path = require('path');

const backtestFile = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(backtestFile, 'utf8');

// Locate the fullData array in backtest.html
const startIdx = content.indexOf('const fullData = [');
if (startIdx === -1) {
    console.error("Could not find fullData in backtest.html!");
    process.exit(1);
}
const endIdx = content.indexOf('];', startIdx);
const arrayString = content.substring(startIdx + 17, endIdx + 1);

// Safely parse the array
const fullData = eval(arrayString);

// Calculate sector statistics
const sectorStats = {};

fullData.forEach(trade => {
    const sector = trade.sector || 'Others';
    const ret = trade.returnPct || 0;
    
    if (!sectorStats[sector]) {
        sectorStats[sector] = {
            totalTrades: 0,
            profitableTrades: 0,
            totalReturn: 0
        };
    }
    
    sectorStats[sector].totalTrades++;
    if (ret > 0) {
        sectorStats[sector].profitableTrades++;
    }
    sectorStats[sector].totalReturn += ret;
});

console.log("=== SECTOR PERFORMANCE ANALYSIS (BACKTEST DATA) ===");
const results = [];
for (const [sector, stats] of Object.entries(sectorStats)) {
    const winRate = (stats.profitableTrades / stats.totalTrades) * 100;
    const avgReturn = stats.totalReturn / stats.totalTrades;
    results.push({
        sector,
        totalTrades: stats.totalTrades,
        winRate,
        avgReturn
    });
}

// Sort by Average Return descending
results.sort((a, b) => b.avgReturn - a.avgReturn);

results.forEach((r, idx) => {
    console.log(`${idx + 1}. Sector: ${r.sector.padEnd(20)} | Trades: ${r.totalTrades.toString().padEnd(3)} | Win Rate: ${r.winRate.toFixed(1)}% | Avg Return: ${r.avgReturn >= 0 ? '+' : ''}${r.avgReturn.toFixed(2)}%`);
});
