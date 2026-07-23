const fs = require('fs');
const path = require('path');

const yesterdayPath = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\history\\data_2026-07-22.json";
if (!fs.existsSync(yesterdayPath)) {
    console.log('Yesterday data file not found:', yesterdayPath);
    process.exit(1);
}

const fileContent = JSON.parse(fs.readFileSync(yesterdayPath, 'utf8'));
// In the history file, is the format a direct array or has topVolume?
// Let's inspect the keys first.
console.log('Keys of data_2026-07-22.json:', Object.keys(fileContent));

const topVolume = fileContent.topVolume || [];
console.log('Number of stocks in topVolume:', topVolume.length);

function getTechniqueMatch(item) {
    if (!item) return null;
    const floor = item.floorLow || (item.price * 0.97);
    const distToFloor = ((item.price - floor) / floor) * 100;
    const touches = item.touchCount || 0;
    const pullback = item.pullback !== null ? item.pullback : 0;
    
    if (item.isCombStock) return null;

    let matched = [];

    // 1. Trend Rider
    const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
    const minTouches = isIpo ? 1 : 3;
    if (distToFloor <= 5.0 && touches >= minTouches && pullback <= 20.0) {
        matched.push('Trend Rider (TR)');
    }

    // 2. Early Spring
    if (item.openPrice) {
        const distToOpen = ((item.price - item.openPrice) / item.openPrice) * 100;
        const isTriggered = item.price >= item.openPrice;
        if (isTriggered && distToOpen <= 5.0 && touches >= 1) {
            matched.push('Early Spring (ES)');
        }
    }

    // 3. Bottom Fishing
    if (pullback >= 35.0 && distToFloor <= 5.0 && touches >= 3) {
        matched.push('Bottom Fishing (BF)');
    }

    return matched;
}

// Find MMCS and STRATUS
const mmcs = topVolume.find(item => item.name === 'MMCS');
const stratus = topVolume.find(item => item.name === 'STRATUS');

if (mmcs) {
    console.log('\n--- MMCS on 22-Jul-2026 ---');
    console.log(`Price: RM ${mmcs.price}`);
    console.log(`Signal: ${mmcs.signal}`);
    console.log(`Pullback: ${mmcs.pullback}%`);
    console.log(`Floor: RM ${mmcs.floorLow} (Dist: ${(((mmcs.price - mmcs.floorLow)/mmcs.floorLow)*100).toFixed(2)}%)`);
    console.log(`Touches: ${mmcs.touchCount}`);
    console.log(`Open Price: RM ${mmcs.openPrice}`);
    console.log(`Matched Techniques:`, getTechniqueMatch(mmcs));
} else {
    console.log('\nMMCS not found in yesterday\'s data.');
}

if (stratus) {
    console.log('\n--- STRATUS on 22-Jul-2026 ---');
    console.log(`Price: RM ${stratus.price}`);
    console.log(`Signal: ${stratus.signal}`);
    console.log(`Pullback: ${stratus.pullback}%`);
    console.log(`Floor: RM ${stratus.floorLow} (Dist: ${(((stratus.price - (stratus.floorLow || stratus.price*0.97))/(stratus.floorLow || stratus.price*0.97))*100).toFixed(2)}%)`);
    console.log(`Touches: ${stratus.touchCount}`);
    console.log(`Open Price: RM ${stratus.openPrice}`);
    console.log(`Matched Techniques:`, getTechniqueMatch(stratus));
} else {
    console.log('\nSTRATUS not found in yesterday\'s data.');
}

// Find all matches under RM1.00 for yesterday
console.log('\n=== All Matches under RM 1.00 on 22-Jul-2026 ===');
const trMatches = [];
const esMatches = [];
const bfMatches = [];

topVolume.forEach(item => {
    if (item.price <= 0 || item.price >= 1.00) return;
    const matches = getTechniqueMatch(item);
    if (!matches) return;
    if (matches.includes('Trend Rider (TR)')) trMatches.push(item.name);
    if (matches.includes('Early Spring (ES)')) esMatches.push(item.name);
    if (matches.includes('Bottom Fishing (BF)')) bfMatches.push(item.name);
});

console.log('TR Matches (yesterday):', trMatches.join(', '));
console.log('ES Matches (yesterday):', esMatches.join(', '));
console.log('BF Matches (yesterday):', bfMatches.join(', '));
