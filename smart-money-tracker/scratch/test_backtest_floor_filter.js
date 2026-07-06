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

// Map grades and sectors
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

// Process trades
const allOriginalTrades = fullData.map(t => {
    const cleanName = t.name.toUpperCase().trim();
    const grade = ipoMap[cleanName] || 'Non-IPO';
    const isIpo = grade !== 'Non-IPO';
    
    let ipoAge = 'Non-IPO';
    if (isIpo) {
        const isFresh = freshIpos.includes(cleanName);
        ipoAge = isFresh ? 'Fresh IPO' : 'Mature IPO';
    }
    
    const sector = predefinedSectors[cleanName] || 'Others';
    let gain = t.finalGain;
    if (t.status === 'SL_HIT') gain = -3.00;
    
    const floor = t.floorLow || (t.entryPrice * 0.95);
    const distToFloor = ((t.entryPrice - floor) / floor) * 100;
    
    return {
        ...t,
        ipoAge,
        sector,
        gain,
        distToFloor,
        isWin: t.status.startsWith('PROFIT') || gain > 0
    };
});

// Run filter: distToFloor <= 7%
const filteredTrades = allOriginalTrades.filter(t => t.distToFloor <= 7.0);

console.log(`=== FILTER COMPARISON (Distance to Floor <= 7%) ===`);
console.log(`Original Trades: ${allOriginalTrades.length}`);
console.log(`Filtered Trades: ${filteredTrades.length} (Removed ${allOriginalTrades.length - filteredTrades.length} overextended trades)`);

// Helper to calculate statistics
function calcStats(items) {
    let wins = 0;
    let totalReturn = 0;
    items.forEach(t => {
        if (t.isWin) wins++;
        totalReturn += t.gain;
    });
    const winRate = items.length > 0 ? (wins / items.length) * 100 : 0;
    const avgReturn = items.length > 0 ? (totalReturn / items.length) : 0;
    return {
        count: items.length,
        winRate: winRate.toFixed(1) + '%',
        totalReturn: totalReturn.toFixed(2) + '%',
        avgReturn: avgReturn.toFixed(2) + '%'
    };
}

console.log("\n--- OVERALL COMPARISON ---");
console.log("Original Stats:", calcStats(allOriginalTrades));
console.log("Filtered Stats:", calcStats(filteredTrades));

// Compare Fresh IPO Industrial specifically
const origFreshInd = allOriginalTrades.filter(t => t.ipoAge === 'Fresh IPO' && t.sector === 'Industrial');
const filtFreshInd = filteredTrades.filter(t => t.ipoAge === 'Fresh IPO' && t.sector === 'Industrial');

console.log("\n--- FRESH IPO INDUSTRIAL SECTOR COMPARISON ---");
console.log("Original Fresh Industrial:", calcStats(origFreshInd));
console.log("Filtered Fresh Industrial:", calcStats(filtFreshInd));

// Show some examples of deleted vs kept trades
console.log("\n--- EXAMPLES OF FILTERED OUT (DELETED) INDUSTRIAL FRESH IPO TRADES ---");
allOriginalTrades.filter(t => t.ipoAge === 'Fresh IPO' && t.sector === 'Industrial' && t.distToFloor > 7.0)
    .slice(0, 5).forEach(t => {
        console.log(`- ${t.name} on ${t.date} | Entry: RM ${t.entryPrice.toFixed(3)} | Floor: RM ${t.floorLow.toFixed(3)} | Dist: ${t.distToFloor.toFixed(1)}% | Gain: ${t.gain}% (Status: ${t.status})`);
    });

console.log("\n--- EXAMPLES OF KEPT INDUSTRIAL FRESH IPO TRADES ---");
filteredTrades.filter(t => t.ipoAge === 'Fresh IPO' && t.sector === 'Industrial')
    .slice(0, 5).forEach(t => {
        console.log(`- ${t.name} on ${t.date} | Entry: RM ${t.entryPrice.toFixed(3)} | Floor: RM ${t.floorLow.toFixed(3)} | Dist: ${t.distToFloor.toFixed(1)}% | Gain: ${t.gain}% (Status: ${t.status})`);
    });
