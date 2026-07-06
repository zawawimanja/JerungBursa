const fs = require('fs');
const path = require('path');

const histFile = path.join(__dirname, '../history/data_2026-07-02.json');
const raw = JSON.parse(fs.readFileSync(histFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

// Simulate index.html filter logic with 12% limit
const validPicks = currentData.filter(item => {
    if (item.name !== 'AMS') return false; // Only test AMS
    
    if (item.signal === 'avoid') return false;
    
    // Simulate calculateSmartScore
    let score = 0;
    const pb = item.pullback !== null ? item.pullback : 0;
    if (pb >= 5.0 && pb <= 15.0) score += 3;
    const isAboveSma50 = item.price >= item.sma50;
    const isAboveSma200 = item.price >= item.sma200;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    if (item.touchCount && item.touchCount >= 2) score += 1;
    if (item.turnover >= 1000000) score += 2;
    if (item.ipoGrade === 'B') score += 2;
    if (item.setupStyle === 'EXPLOSIVE') score += 2;
    const finalScore = Math.min(15, score);
    
    const isPremiumIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B';
    const minScore = isPremiumIpo ? 10 : 12;
    if (finalScore < minScore) return false;
    
    // Strict entry filter simulation with 12% threshold
    const floor = item.floorLow || (item.price * 0.95);
    const distToFloor = ((item.price - floor) / floor) * 100;
    console.log(`- Simulated AMS distToFloor: ${distToFloor.toFixed(2)}%`);
    if (distToFloor > 12.0) {
        console.log(`❌ AMS failed strict entry filter of 12%`);
        return false;
    }
    
    console.log(`✅ AMS passed all filters (Score: ${finalScore}, Distance: ${distToFloor.toFixed(2)}%)`);
    return true;
});

console.log(`AMS July 2nd Rendered count: ${validPicks.length}`);
