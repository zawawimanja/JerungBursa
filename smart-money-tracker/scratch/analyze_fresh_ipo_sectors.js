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

// Map grades and sectors dynamically like index.html
const ipoMap = {
    'SKYECHIP': 'A', 'PENTECH': 'A', 'ECOSHOP': 'A', 'EMPIRE': 'A', 'SRKK': 'A',
    'SUM': 'B', 'ELSA': 'B', 'NE': 'B', 'AMBEST': 'B', 'AMS': 'B',
    'EIPOWER': 'B', 'ISF': 'B', 'KEEMING': 'B', 'TEAMSTR': 'B', 'CBHB': 'B',
    'HEGROUP': 'B', 'MNHLDG': 'B', 'TMK': 'B', 'YEWLEE': 'B', 'HKB': 'B', 'UUE': 'B',
    'MMCS': 'C', 'GDGROUP': 'C', 'GOLDLI': 'C', 'HOCKSOON': 'C', 'OGX': 'C', 'SBS': 'C'
};

const freshIpos = [
    'SKYECHIP', 'PENTECH', 'SUM', 'ELSA', 'AMBEST', 'AMS',
    'EIPOWER', 'ISF', 'KEEMING', 'TEAMSTR', 'MMCS', 'GDGROUP',
    'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE'
];

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
    'GIIB': 'Industrial', 'MCLEAN': 'Industrial', 'EXSIMHB': 'Consumer'
};

// Filter for Fresh IPOs only
const freshIpoTrades = [];

fullData.forEach(t => {
    const cleanName = t.name.toUpperCase().trim();
    const isFresh = freshIpos.includes(cleanName);
    if (isFresh) {
        const sector = predefinedSectors[cleanName] || 'Others';
        let gain = t.finalGain;
        if (t.status === 'SL_HIT') {
            gain = -3.00;
        }
        freshIpoTrades.push({
            ...t,
            sector,
            gain,
            isWin: t.status.startsWith('PROFIT') || gain > 0
        });
    }
});

// Group by sector for Fresh IPOs
const groups = {};
freshIpoTrades.forEach(item => {
    const key = item.sector;
    if (!groups[key]) {
        groups[key] = { sector: key, count: 0, wins: 0, totalReturn: 0, tradesList: [] };
    }
    groups[key].count++;
    if (item.isWin) groups[key].wins++;
    groups[key].totalReturn += item.gain;
    groups[key].tradesList.push(item);
});

const report = Object.values(groups).map(g => {
    const winRate = (g.wins / g.count) * 100;
    const avgReturn = g.totalReturn / g.count;
    
    // Get unique counters in this sector
    const counters = [...new Set(g.tradesList.map(t => t.name))];
    
    return {
        sector: g.sector,
        count: g.count,
        winRate: winRate.toFixed(1) + '%',
        totalReturn: g.totalReturn.toFixed(2) + '%',
        avgReturn: avgReturn.toFixed(2) + '%',
        counters: counters.join(', ')
    };
}).sort((a, b) => parseFloat(b.totalReturn) - parseFloat(a.totalReturn));

console.log("\n=== FRESH IPO SECTORS PERFORMANCE ===");
console.table(report);
