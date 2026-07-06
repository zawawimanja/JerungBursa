const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

// Map grades dynamically like index.html:
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

function isFreshIpo(item) {
    if (!item || !item.ipoGrade) return false;
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
    if (isFreshIpo(item)) return false;
    if (item.isCombStock) return true;
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('COMB') || reason.includes('AVOID') || reason.includes('ILLIQUID')) return true;
    return false;
}

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;
    
    if (item.isConsolidation) score += 2;
    
    if (pullbackVal <= 5.0) score += 3;
    else if (pullbackVal <= 12.0) score += 2;
    else if (pullbackVal <= 25.0) score += 1;
    
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    if (item.turnover >= 5000000) score += 1;
    
    if (item.ipoGrade === 'A') score += 3;
    else if (item.ipoGrade === 'B') score += 2;
    else if (item.ipoGrade === 'C') score += 1;
    
    if (pullbackVal <= 3.0 && isAboveSma50 && isAboveSma200) {
        score += 2;
    }
    
    const isFresh = isFreshIpo(item);
    if (isFresh && (item.setupStyle === 'EXPLOSIVE' || (item.setupName && item.setupName.toUpperCase().includes('EXPLOSIVE')))) {
        score += 2;
    }
    
    return Math.min(15, score);
}

// Map grade to each item
currentData.forEach(item => {
    const cleanName = item.name.toUpperCase().trim();
    if (ipoMap[cleanName]) {
        item.ipoGrade = ipoMap[cleanName];
    } else {
        const foundKey = Object.keys(ipoMap).find(key => {
            const normKey = key.replace(/[^A-Z0-9]/g, '');
            const normName = cleanName.replace(/[^A-Z0-9]/g, '');
            return normName.startsWith(normKey);
        });
        if (foundKey) {
            item.ipoGrade = ipoMap[foundKey];
        }
    }
});

let validPicks = currentData.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
    const isPremiumIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B';
    const maxPullbackLimit = isIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    if (!hasPullback) return false;

    if (isSleepingOrAvoidStock(item)) return false;
    if (item.price < 0.25 || item.price > 4.00) return false;
    
    const minTurnover = isIpo ? 400000 : 750000;
    if (item.turnover < minTurnover) return false;
    
    const minScore = isPremiumIpo ? 10 : (item.ipoGrade === 'C' ? 11 : 12);
    const score = calculateSmartScore(item);
    if (score < minScore) return false;

    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'EXPLOSIVE' || style === 'STAIRCASE' || isPremiumIpo;
});

console.log(`Matched ${validPicks.length} picks.`);
const he = validPicks.find(s => s.name === 'HEGROUP');
if (he) {
    console.log("HEGROUP is MATCHED! Score:", calculateSmartScore(he));
} else {
    console.log("HEGROUP is NOT matched in render list.");
    // Let's see if it exists in currentData at all
    const rawHe = currentData.find(s => s.name === 'HEGROUP');
    if (rawHe) {
        console.log("HEGROUP exists in live_data.json but was filtered out.");
        console.log("Raw properties:", JSON.stringify(rawHe, null, 2));
        console.log("calculateSmartScore:", calculateSmartScore(rawHe));
        console.log("isSleepingOrAvoidStock:", isSleepingOrAvoidStock(rawHe));
        console.log("isFreshIpo:", isFreshIpo(rawHe));
    } else {
        console.log("HEGROUP does NOT exist in live_data.json!");
    }
}
