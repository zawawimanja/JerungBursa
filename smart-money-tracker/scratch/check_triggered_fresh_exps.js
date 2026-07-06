const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../history');
if (!fs.existsSync(historyDir)) {
    console.error("History directory not found!");
    process.exit(1);
}

const files = fs.readdirSync(historyDir).filter(f => f.startsWith('data_') && f.endsWith('.json')).sort();

// IPO grade map from index.html:
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

function isFreshIpo(name, ipoYear) {
    if (ipoYear !== undefined) {
        return ipoYear >= 2025;
    }
    const cleanName = name.toUpperCase().trim();
    return freshIpos.includes(cleanName);
}

function calculateBaseScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null && item.pullback !== undefined ? item.pullback : 0;
    
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
    
    // Grade booster:
    const grade = ipoMap[item.name.toUpperCase().trim()] || item.ipoGrade;
    if (grade === 'A') score += 3;
    else if (grade === 'B') score += 2;
    else if (grade === 'C') score += 1;
    
    // VVIP booster (if tag is there):
    if (item.isVvip || item.signal === 'buy') {
        score += 2;
    }
    
    return Math.min(15, score);
}

console.log("=== SCANNING HISTORICAL FRESH IPO EXPLOSIVE TRIGGERS ===");
console.log("-----------------------------------------------------------------------------------------");
console.log("Date       | Stock    | Base Score | Boosted Score | Min Req | Status");
console.log("-----------------------------------------------------------------------------------------");

files.forEach(file => {
    const date = file.replace('data_', '').replace('.json', '');
    const raw = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.topVolume || []);
    
    list.forEach(item => {
        const name = item.name.toUpperCase().trim();
        const ipoYear = item.ipoYear;
        
        if (isFreshIpo(name, ipoYear)) {
            const style = (item.setupStyle || '').toUpperCase();
            const setupName = (item.setupName || '').toUpperCase();
            const isExplosive = style === 'EXPLOSIVE' || setupName.includes('EXPLOSIVE');
            
            if (isExplosive) {
                const baseScore = calculateBaseScore(item);
                const boostedScore = Math.min(15, baseScore + 2);
                
                const grade = ipoMap[name] || item.ipoGrade || 'B';
                const minReq = grade === 'A' || grade === 'B' ? 10 : 11;
                
                // Did it trigger only after boost?
                if (baseScore < minReq && boostedScore >= minReq) {
                    console.log(`${date} | ${name.padEnd(8)} | ${String(baseScore).padStart(10)} | ${String(boostedScore).padStart(13)} | ${String(minReq).padStart(7)} | 🚀 NEW TRIGGER!`);
                } else if (baseScore >= minReq) {
                    // Already triggered
                    console.log(`${date} | ${name.padEnd(8)} | ${String(baseScore).padStart(10)} | ${String(boostedScore).padStart(13)} | ${String(minReq).padStart(7)} | ✅ Already Triggered`);
                }
            }
        }
    });
});
console.log("-----------------------------------------------------------------------------------------");
