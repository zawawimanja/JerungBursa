const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

// Frontend age checks in index.html
const ipoMap = {
    'SKYECHIP': 'A', 'PENTECH': 'A', 'ECOSHOP': 'A', 'EMPIRE': 'A', 'SRKK': 'A',
    'SUM': 'B', 'ELSA': 'B', 'NE': 'B', 'AMBEST': 'B', 'AMS': 'B',
    'EIPOWER': 'B', 'ISF': 'B', 'KEEMING': 'B', 'TEAMSTR': 'B', 'CBHB': 'B',
    'HEGROUP': 'B', 'MNHLDG': 'B', 'TMK': 'B', 'YEWLEE': 'B', 'HKB': 'B', 'UUE': 'B',
    'MMCS': 'C', 'GDGROUP': 'C', 'GOLDLI': 'C', 'HOCKSOON': 'C', 'OGX': 'C', 'SBS': 'C',
    '3REN': 'B'
};

const freshIpos = [
    'SKYECHIP', 'PENTECH', 'SUM', 'ELSA', 'AMBEST', 'AMS',
    'EIPOWER', 'ISF', 'KEEMING', 'TEAMSTR', 'MMCS', 'GDGROUP',
    'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE', '3REN'
];

function isFreshIpo(item) {
    if (!item) return false;
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return false;
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('AVOID')) return false;

    if (item.ipoYear !== undefined) {
        return item.ipoYear >= 2025;
    }

    const cleanName = item.name.toUpperCase().trim();
    return freshIpos.includes(cleanName) || Object.keys(ipoMap).some(key => {
        if (!freshIpos.includes(key)) return false;
        const normKey = key.replace(/[^A-Z0-9]/g, '');
        const normName = cleanName.replace(/[^A-Z0-9]/g, '');
        return normName.startsWith(normKey);
    });
}

function isSleepingOrAvoidStock(item) {
    if (!item) return false;
    if (item.isCombStock) return true;
    
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('OVEREXTENDED') || reason.includes('ILLIQUID')) return true;

    if (isFreshIpo(item)) return false;

    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
    if (reason.includes('COMB') || reason.includes('AVOID')) return true;
    
    return false;
}

// Emulate renderTrendRiders filtering logic
const renderedPicks = currentData.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    
    const grade = item.ipoGrade || ipoMap[item.name.toUpperCase().trim()] || 'Unrated';
    const isIpo = grade === 'A' || grade === 'B' || grade === 'C';
    
    const maxPullbackLimit = isIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    if (!hasPullback) return false;

    if (isSleepingOrAvoidStock(item)) return false;
    
    // Must be BUY signal
    return item.signal === 'buy';
});

console.log(`=== DISPLAYED IN INDEX.HTML (ALL TAB): ${renderedPicks.length} picks ===`);
renderedPicks.slice(0, 15).forEach((p, idx) => {
    const floor = p.floorLow || (p.price * 0.95);
    const dist = ((p.price - floor) / floor) * 100;
    console.log(`[#${idx+1}] ${p.name} | Grade: ${p.ipoGrade || 'Unrated'} | VVIP: ${p.isVvip} | Setup: ${p.setupName} | Price: RM ${p.price.toFixed(3)} | Floor: RM ${floor.toFixed(3)} | Dist: ${dist.toFixed(1)}%`);
});
