const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '../history');
const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

const ipoMap = {
    'SKYECHIP': 'A', 'PENTECH': 'A', 'ECOSHOP': 'A', 'EMPIRE': 'A', 'SRKK': 'A',
    'SUM': 'B', 'ELSA': 'B', 'NE': 'B', 'AMBEST': 'B', 'AMS': 'B',
    'EIPOWER': 'B', 'ISF': 'B', 'KEEMING': 'B', 'TEAMSTR': 'B', 'CBHB': 'B',
    'HEGROUP': 'B', 'MNHLDG': 'B', 'TMK': 'B', 'YEWLEE': 'B', 'HKB': 'B', 'UUE': 'B',
    'MMCS': 'C', 'GDGROUP': 'C', 'GOLDLI': 'C', 'HOCKSOON': 'C', 'OGX': 'C', 'SBS': 'C'
};

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
    
    const grade = item.ipoGrade || ipoMap[item.name.toUpperCase().trim()];
    if (grade === 'A') score += 3;
    else if (grade === 'B') score += 2;
    else if (grade === 'C') score += 1;
    
    if (pullbackVal <= 3.0 && isAboveSma50 && isAboveSma200) {
        score += 2;
    }
    
    return Math.min(15, score);
}

console.log('-------------------------------------------------------------------------------------------------------------------');
console.log('Date       | Price   | Signal  | Score | Setup Style | Proximity | Setup Name            | Reason');
console.log('-------------------------------------------------------------------------------------------------------------------');

files.forEach(file => {
    const dateStr = file.replace('data_', '').replace('.json', '');
    // Only look at dates in June/July 2026
    if (dateStr < '2026-06-15') return;
    
    const filePath = path.join(HISTORY_DIR, file);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const list = Array.isArray(rawData) ? rawData : (rawData.topVolume || []);
    
    const ams = list.find(x => x.name.toUpperCase() === 'AMS');
    if (ams) {
        const score = calculateSmartScore(ams);
        const floorLow = ams.floorLow || (ams.price * 0.95);
        const distToFloor = ((ams.price - floorLow) / floorLow) * 100;
        
        console.log(
            `${dateStr} | RM ${ams.price.toFixed(3)} | ${(ams.signal || 'avoid').toUpperCase().padEnd(7)} | ${score.toString().padStart(2)}/15 | ${(ams.setupStyle || 'SWING').padEnd(11)} | ${distToFloor.toFixed(1).padStart(4)}%      | ${(ams.setupName || 'N/A').padEnd(21)} | ${ams.reason}`
        );
    } else {
        console.log(`${dateStr} | N/A (Not in scanner today)`);
    }
});
console.log('-------------------------------------------------------------------------------------------------------------------');
