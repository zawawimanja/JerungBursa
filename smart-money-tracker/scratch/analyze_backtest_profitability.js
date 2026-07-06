const fs = require('fs');
const path = require('path');

// Load backtest.html
const backtestFile = path.join(__dirname, '../backtest.html');
if (!fs.existsSync(backtestFile)) {
    console.error("backtest.html not found!");
    process.exit(1);
}

const html = fs.readFileSync(backtestFile, 'utf8');

// Extract fullData array using regex
const match = html.match(/const\s+fullData\s*=\s*(\[[\s\S]*?\]);/);
if (!match) {
    console.error("Could not find fullData array in backtest.html!");
    process.exit(1);
}

// Safely parse the array
const fullData = eval(match[1]);

console.log(`Successfully loaded ${fullData.length} historical trades from backtest database!`);

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

// 1. Enrich data with IPO Age class and Sector
const trades = fullData.map(t => {
    const cleanName = t.name.toUpperCase().trim();
    const grade = ipoMap[cleanName] || 'Non-IPO';
    const isIpo = grade !== 'Non-IPO';
    
    // Determine Fresh vs Mature vs Non-IPO
    // 2025/2026 is Fresh, 2019-2024 is Mature, before 2019 or no grade is Non-IPO
    let ipoAge = 'Non-IPO';
    if (isIpo) {
        // We know Fresh IPOs from our list
        const isFresh = freshIpos.includes(cleanName);
        ipoAge = isFresh ? 'Fresh IPO' : 'Mature IPO';
    }
    
    const sector = predefinedSectors[cleanName] || 'Others';
    
    // Enforce strict Stop Loss of -3.00% if status is SL_HIT
    let gain = t.finalGain;
    if (t.status === 'SL_HIT') {
        gain = -3.00;
    }
    
    return {
        ...t,
        ipoAge,
        sector,
        gain,
        isWin: t.status.startsWith('PROFIT') || gain > 0
    };
});

// Helper for aggregation
function aggregate(items, keyFn) {
    const groups = {};
    items.forEach(item => {
        const key = keyFn(item);
        if (!groups[key]) {
            groups[key] = { name: key, count: 0, wins: 0, totalReturn: 0, gains: [] };
        }
        groups[key].count++;
        if (item.isWin) groups[key].wins++;
        groups[key].totalReturn += item.gain;
        groups[key].gains.push(item.gain);
    });
    
    return Object.values(groups).map(g => {
        const winRate = (g.wins / g.count) * 100;
        const avgReturn = g.totalReturn / g.count;
        return {
            name: g.name,
            count: g.count,
            winRate: winRate.toFixed(1) + '%',
            totalReturn: g.totalReturn.toFixed(2) + '%',
            avgReturn: avgReturn.toFixed(2) + '%'
        };
    }).sort((a, b) => parseFloat(b.totalReturn) - parseFloat(a.totalReturn));
}

console.log("\n=== 1. IPO AGE CATEGORY PROFITABILITY ===");
console.table(aggregate(trades, t => t.ipoAge));

console.log("\n=== 2. SECTOR PROFITABILITY ===");
console.table(aggregate(trades, t => t.sector));

console.log("\n=== 3. SETUP STYLE PROFITABILITY ===");
console.table(aggregate(trades, t => t.style));

// Compute VVIP stats
const vvipTrades = trades.filter(t => {
    // Replicate VVIP detection logic
    // We will just calculate for VVIP subset if we want, but since VVIP relies on history,
    // let's look at their performance.
    return t.isVvip;
});
if (vvipTrades.length > 0) {
    console.log("\n=== 4. VVIP (MOMENTUM CONTINUATION) SUBSET ===");
    console.log(`Total VVIP Trades: ${vvipTrades.length}`);
    const vvipAggr = aggregate(vvipTrades, () => 'VVIP');
    console.table(vvipAggr);
}
