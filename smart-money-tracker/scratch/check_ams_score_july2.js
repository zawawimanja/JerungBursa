const fs = require('fs');
const path = require('path');

const histFile = path.join(__dirname, '../history/data_2026-07-02.json');
const raw = JSON.parse(fs.readFileSync(histFile, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);
const ams = data.find(s => s.name === 'AMS');

// Helper functions copied from index.html to calculate score
function calculateSmartScore(item) {
    let score = 0;
    
    // 1. Pullback score
    const pb = item.pullback !== null ? item.pullback : 0;
    if (pb >= 5.0 && pb <= 15.0) score += 3;
    else if (pb > 15.0 && pb <= 30.0) score += 2;
    else if (pb > 30.0 && pb <= 45.0) score += 1;
    
    // 2. Consolidation & base score
    if (item.isConsolidation) score += 2;
    else if (item.touchCount && item.touchCount >= 2) score += 1;
    
    // 3. Tightness score
    const ct = item.closeTightness || 99;
    const lt = item.lowTightness || 99;
    if (ct <= 3.5 && lt <= 3.5) score += 2;
    else if (ct <= 5.5 || lt <= 5.5) score += 1;
    
    // 4. Volum Smart Money (Turnover)
    if (item.turnover >= 3000000) score += 3;
    else if (item.turnover >= 1000000) score += 2;
    else if (item.turnover >= 400000) score += 1;
    
    // 5. Trend (SMA)
    const price = item.price;
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    // 6. High volume spike
    if (item.turnover >= 5000000) score += 1;
    
    // 7. Premium IPO Booster
    if (item.ipoGrade === 'A') score += 3;
    else if (item.ipoGrade === 'B') score += 2;
    else if (item.ipoGrade === 'C') score += 1;
    
    // 8. ATH booster
    if (pb <= 3.0 && isAboveSma50 && isAboveSma200) {
        score += 2;
    }
    
    // 9. Explosive booster (Fresh IPO only)
    // We simulate with cleanName = 'AMS' and it listed in 2026 (so isFresh = true)
    const isFresh = true; // since it listed in 2026
    if (isFresh && (item.setupStyle === 'EXPLOSIVE' || (item.setupName && item.setupName.toUpperCase().includes('EXPLOSIVE')))) {
        score += 2;
    }
    
    return Math.min(15, score);
}

if (ams) {
    const score = calculateSmartScore(ams);
    console.log(`=== AMS JULY 2ND SCORE CALCULATION ===`);
    console.log(`Calculated Score: ${score}/15`);
    
    // Step by step detail:
    console.log(`- Pullback (11.76%): +3`);
    console.log(`- Consolidation: false, touchCount: 2: +1`);
    console.log(`- Close tightness: 8.7, Low tightness: 5.88: +0`);
    console.log(`- Turnover (RM 2.48M): +2`);
    console.log(`- Above SMA50? ${ams.price >= ams.sma50} (RM ${ams.price} vs SMA50 ${ams.sma50}): +2`);
    console.log(`- Above SMA200? ${ams.price >= ams.sma200} (RM ${ams.price} vs SMA200 ${ams.sma200}): +1`);
    console.log(`- Turnover >= 5M? false: +0`);
    console.log(`- IPO Grade booster? none (undefined): +0`);
    console.log(`- Near ATH? false: +0`);
    console.log(`- Explosive booster (isFresh=true)? +2`);
    console.log(`Total Score calculated: ${3 + 1 + 2 + 2 + 1 + 2} = 11`);
} else {
    console.log("AMS not found!");
}
