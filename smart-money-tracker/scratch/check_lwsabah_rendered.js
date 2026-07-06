const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

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
    if (item.ipoYear !== undefined) return item.ipoYear >= 2025;
    const cleanName = item.name.toUpperCase().trim();
    return freshIpos.includes(cleanName);
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
    return item.signal === 'buy';
});

console.log("=== CHECKING SPECIFIC BUYS IN RENDERED ARRAY ===");
const listToCheck = ['LWSABAH', 'UWC', 'ITMAX', 'MNHLDG', 'AMBEST', 'HEGROUP'];

listToCheck.forEach(name => {
    const foundIdx = renderedPicks.findIndex(p => p.name.toUpperCase().trim() === name);
    const foundInLive = currentData.find(p => p.name.toUpperCase().trim() === name);
    
    if (foundIdx !== -1) {
        console.log(`✅ ${name} IS RENDERED! Index: ${foundIdx + 1} of ${renderedPicks.length}`);
    } else {
        console.log(`❌ ${name} IS NOT RENDERED!`);
        if (foundInLive) {
            console.log(`   In live_data: signal="${foundInLive.signal}", reason="${foundInLive.reason}", pullback=${foundInLive.pullback}, high52=${foundInLive.high52}, isComb=${foundInLive.isCombStock}, setup="${foundInLive.setupName}"`);
        } else {
            console.log(`   Not even in live_data.json!`);
        }
    }
});
