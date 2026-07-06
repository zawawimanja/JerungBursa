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
const trades = fullData.map(t => {
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

const thresholds = [5, 7, 10, 12, 15, 20, 100];
const results = thresholds.map(th => {
    const filtered = trades.filter(t => t.distToFloor <= th);
    let wins = 0;
    let totalReturn = 0;
    filtered.forEach(t => {
        if (t.isWin) wins++;
        totalReturn += t.gain;
    });
    const winRate = filtered.length > 0 ? (wins / filtered.length) * 100 : 0;
    const avgReturn = filtered.length > 0 ? (totalReturn / filtered.length) : 0;
    
    return {
        threshold: th === 100 ? 'Unfiltered (100%)' : `<= ${th}%`,
        count: filtered.length,
        winRate: winRate.toFixed(1) + '%',
        totalReturn: totalReturn.toFixed(2) + '%',
        avgReturn: avgReturn.toFixed(2) + '%'
    };
});

console.log("\n=== COMPARING DIFFERENT DIST-TO-FLOOR THRESHOLDS ===");
console.table(results);
