const fs = require('fs');
const path = require('path');

const liveData = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_data.json'), 'utf8'));
const currentData = liveData.topVolume || [];

console.log(`Total stocks in currentData: ${currentData.length}\n`);

// Simulate calculateSmartScore & helper functions from index.html
function isSleepingOrAvoidStock(item) {
    if (item.signal === 'avoid') return true;
    if (item.reason && item.reason.includes('Avoid Trading')) return true;
    return false;
}

function calculateSmartScore(item) {
    let score = 0;
    if (item.signal === 'buy') score += 5;
    if (item.touchCount >= 3) score += 3;
    if (item.touchCount >= 5) score += 2;
    if (item.isConsolidation) score += 2;
    if (item.turnover >= 500000) score += 2;
    if (item.turnover >= 1000000) score += 1;
    return score;
}

function getItemStyle(item) {
    return item.setupStyle || 'SWING PLAY';
}

function matchesIpoAgeFilter(item, val) {
    return true; // default
}

function isFreshIpo(item) {
    return !!item.ipoDate;
}

console.log('=== TESTING validPicks FILTER ===');

let passCount = 0;
let failReasons = {};

currentData.forEach(item => {
    let reason = '';
    
    if (!item.high52) {
        reason = 'No high52';
    } else {
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
        const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
        const isPremiumIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B';
        const maxPullbackLimit = isIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
        const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
        
        if (!hasPullback) {
            reason = `Pullback out of limit (${pullbackVal} > ${maxPullbackLimit})`;
        } else if (isSleepingOrAvoidStock(item)) {
            reason = `Sleeping/Avoid stock (signal: ${item.signal}, reason: ${item.reason})`;
        } else if (item.price < 0.25 || item.price > 4.00) {
            reason = `Price out of bounds (RM ${item.price})`;
        } else if (item.turnover < (isIpo ? 400000 : 750000)) {
            reason = `Turnover too low (RM ${item.turnover})`;
        } else if (calculateSmartScore(item) < (isPremiumIpo ? 10 : (item.ipoGrade === 'C' ? 11 : 12))) {
            reason = `Score too low (${calculateSmartScore(item)})`;
        } else {
            const style = getItemStyle(item);
            if (style !== 'EXPLOSIVE' && style !== 'STAIRCASE' && !isPremiumIpo) {
                reason = `Style not match (${style})`;
            }
        }
    }
    
    if (!reason) {
        passCount++;
        console.log(`✅ PASSED: ${item.name} (RM ${item.price}) | Signal: ${item.signal} | Setup: ${item.setupStyle} | Turnover: RM ${(item.turnover/1000).toFixed(0)}k`);
    } else {
        failReasons[reason] = (failReasons[reason] || 0) + 1;
    }
});

console.log(`\nTotal Passed: ${passCount} / ${currentData.length}`);
console.log('\nTop Fail Reasons Breakdown:');
Object.entries(failReasons).sort((a, b) => b[1] - a[1]).forEach(([r, count]) => {
    console.log(`- ${r}: ${count} stocks`);
});
