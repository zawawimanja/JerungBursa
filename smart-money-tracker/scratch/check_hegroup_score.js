const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../history/data_2026-07-06.json');
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.topVolume || []);

const hegroup = list.find(s => s.name.toUpperCase().includes('HEGROUP'));

// Replicate index.html calculateSmartScore:
function getScoreAndBreakdown(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null && item.pullback !== undefined ? item.pullback : 0;
    
    let proximityPoints = 0;
    if (distToFloor <= 1.5) proximityPoints = 4;
    else if (distToFloor <= 3.0) proximityPoints = 2;
    else if (distToFloor <= 5.0) proximityPoints = 1;
    score += proximityPoints;
    
    let touchPoints = 0;
    if (item.touchCount >= 5) touchPoints = 3;
    else if (item.touchCount >= 3) touchPoints = 2;
    else if (item.touchCount >= 2) touchPoints = 1;
    score += touchPoints;
    
    let consolPoints = item.isConsolidation ? 2 : 0;
    score += consolPoints;
    
    let pullbackPoints = 0;
    if (pullbackVal <= 5.0) pullbackPoints = 3;
    else if (pullbackVal <= 12.0) pullbackPoints = 2;
    else if (pullbackVal <= 25.0) pullbackPoints = 1;
    score += pullbackPoints;
    
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    let smaPoints = 0;
    if (isAboveSma50) smaPoints += 2;
    if (isAboveSma200) smaPoints += 1;
    score += smaPoints;
    
    let volumePoints = item.turnover >= 5000000 ? 1 : 0;
    score += volumePoints;
    
    let gradePoints = 0;
    if (item.ipoGrade === 'A') gradePoints = 3;
    else if (item.ipoGrade === 'B') gradePoints = 2;
    else if (item.ipoGrade === 'C') gradePoints = 1;
    score += gradePoints;
    
    let momentumBooster = (pullbackVal <= 3.0 && isAboveSma50 && isAboveSma200) ? 2 : 0;
    score += momentumBooster;
    
    // Explosive booster (restricted to Fresh IPOs listing >= 2025):
    const isFresh = item.ipoYear !== undefined && item.ipoYear >= 2025;
    const style = (item.setupStyle || '').toUpperCase();
    const setupName = (item.setupName || '').toUpperCase();
    let expBooster = 0;
    if (isFresh && (style === 'EXPLOSIVE' || setupName.includes('EXPLOSIVE'))) {
        expBooster = 2;
    }
    score += expBooster;
    
    return {
        score: Math.min(15, score),
        breakdown: {
            price,
            floorLow,
            distToFloor,
            pullbackVal,
            proximityPoints,
            touchPoints,
            consolPoints,
            pullbackPoints,
            smaPoints,
            volumePoints,
            gradePoints,
            momentumBooster,
            expBooster
        }
    };
}

console.log("=== HEGROUP SCORE ANALYSIS ===");
if (hegroup) {
    console.log(JSON.stringify(getScoreAndBreakdown(hegroup), null, 2));
} else {
    console.log("HEGROUP NOT FOUND!");
}
