const fs = require('fs');
const path = require('path');

// 1. Load sectors from data.json
const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const ipos = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));
const nameToSector = {};

ipos.forEach(ipo => {
    const sym = ipo.symbol ? ipo.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim() : '';
    const name = ipo.companyName ? ipo.companyName.replace(/\[.*?\]/g, '').toUpperCase().trim() : '';
    let sec = ipo.sector ? ipo.sector.split(' ')[0] : 'Others';
    if (sec.includes('(')) sec = sec.split('(')[0].trim();
    
    if (sym) nameToSector[sym] = sec;
    if (name) nameToSector[name] = sec;
});

// Fallbacks from scrape-real.js
const predefinedSectors = {
    'SKYECHIP': 'Technology', 'OPPSTAR': 'Technology', 'EIPOWER': 'Industrial',
    'PENTECH': 'Industrial', 'KEEMING': 'Consumer', 'SUM': 'Technology',
    'ADNEX': 'Technology', 'HKB': 'Technology', 'AMBEST': 'Consumer',
    'SUNMED': 'Healthcare', 'MMCS': 'Technology', 'DNEX': 'Technology',
    'AMS': 'Industrial', 'SDCG': 'Utilities', 'NE': 'Technology',
    'ISF': 'Consumer', 'OGX': 'Industrial', 'MNHLDG': 'Technology',
    'LWSABAH': 'Utilities', 'CBHB': 'Property', 'IAB': 'Consumer',
    'CNERGEN': 'Technology', 'ELSA': 'Technology', 'SAM': 'Industrial',
    'TMK': 'Industrial', 'ZETRIX': 'Technology', 'NATGATE': 'Technology',
    'GIIB': 'Industrial', 'MCLEAN': 'Industrial', 'EXSIMHB': 'Consumer',
    'HEGROUP': 'Industrial', 'UWC': 'Industrial', 'ITMAX': 'Technology',
    'SLVEST': 'Utilities', 'YEWLEE': 'Industrial', 'SFPTECH': 'Industrial',
    'ECA': 'Technology', 'SFP': 'Industrial', 'NATIONGATE': 'Technology',
    'INFOM': 'Technology', 'TTVISION': 'Technology', 'OPPSTAR': 'Technology'
};

// 2. Load trades from backtest.html
const backtestFile = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(backtestFile, 'utf8');

const startIdx = content.indexOf('const fullData = [');
const endIdx = content.indexOf('];', startIdx);
const arrayString = content.substring(startIdx + 17, endIdx + 1);
const fullData = eval(arrayString);

// 3. Map and calculate
const sectorStats = {};

fullData.forEach(trade => {
    const name = trade.name.toUpperCase().trim();
    let sector = predefinedSectors[name] || nameToSector[name] || 'Others';
    
    // Clean up sector naming
    if (sector.toLowerCase().startsWith('tech')) sector = 'Technology';
    if (sector.toLowerCase().startsWith('indust')) sector = 'Industrial';
    if (sector.toLowerCase().startsWith('consum')) sector = 'Consumer';
    if (sector.toLowerCase().startsWith('utilit')) sector = 'Utilities';
    if (sector.toLowerCase().startsWith('teleco')) sector = 'Telecommunications';
    if (sector.toLowerCase().startsWith('proper')) sector = 'Property';
    if (sector.toLowerCase().startsWith('health')) sector = 'Healthcare';
    if (sector.toLowerCase().startsWith('transp')) sector = 'Transportation';

    const ret = trade.finalGain || 0;
    
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

console.log("=== DETAILED SECTOR PERFORMANCE IN June BACKTEST ===");
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
