const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../history/data_2026-07-06.json');
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.topVolume || []);

const item = list.find(s => s.name.toUpperCase().trim() === 'HEGROUP');

if (!item) {
    console.log("HEGROUP not found!");
    process.exit(0);
}

// Map grade
item.ipoGrade = 'B';

const isFresh = (item.ipoYear !== undefined && item.ipoYear >= 2025);
const setup = (item.setupName || '').toUpperCase();
const reason = (item.reason || '').toUpperCase();
const isComb = !!item.isCombStock;

console.log("=== HEGROUP PROPERTIES ===");
console.log("Name:", item.name);
console.log("Price:", item.price);
console.log("Turnover:", item.turnover);
console.log("Setup Name:", item.setupName);
console.log("Setup Style:", item.setupStyle);
console.log("Reason:", item.reason);
console.log("Is Comb Stock:", item.isCombStock);
console.log("ipoYear:", item.ipoYear);

console.log("\n=== FILTER EVALUATION ===");
console.log("1. isFreshIpo:", isFresh);
console.log("2. isCombStock:", isComb);
console.log("3. setup Avoid/Downtrend:", setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A');
console.log("4. reason Avoid/Comb/Illiquid:", reason.includes('COMB') || reason.includes('AVOID') || reason.includes('ILLIQUID'));

// Check render filters:
const isPremiumIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B';
const pullbackVal = item.pullback !== null ? item.pullback : 0;
const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
const maxPullbackLimit = isPremiumIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;

console.log("5. hasPullback (limit " + maxPullbackLimit + "):", hasPullback, "pullbackVal:", pullbackVal);
console.log("6. price check (0.25 - 4.00):", item.price >= 0.25 && item.price <= 4.00);
console.log("7. turnover check (min 400k for IPO):", item.turnover >= 400000);
console.log("8. Smart Score check (min 10 for Premium):", getScore(item), "score >= 10:", getScore(item) >= 10);

function getScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pb = item.pullback !== null ? item.pullback : 0;
    
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;
    
    if (item.isConsolidation) score += 2;
    
    if (pb <= 5.0) score += 3;
    else if (pb <= 12.0) score += 2;
    else if (pb <= 25.0) score += 1;
    
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    if (item.turnover >= 5000000) score += 1;
    
    if (item.ipoGrade === 'A') score += 3;
    else if (item.ipoGrade === 'B') score += 2;
    else if (item.ipoGrade === 'C') score += 1;
    
    if (pb <= 3.0 && isAboveSma50 && isAboveSma200) score += 2;
    
    return Math.min(15, score);
}
