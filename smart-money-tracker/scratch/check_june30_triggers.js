const fs = require('fs');
const path = require('path');

const file30 = path.join(__dirname, '../history/data_2026-06-30.json');

if (!fs.existsSync(file30)) {
    console.error("❌ Fail data_2026-06-30.json tidak dijumpai.");
    process.exit(1);
}

const data30 = JSON.parse(fs.readFileSync(file30, 'utf8'));
const stocks30 = Array.isArray(data30) ? data30 : (data30.topVolume || []);

const candidates30 = stocks30.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    
    const isBouncing = item.change > 0;
    const isDowntrend = item.setupName && (
        item.setupName.includes('Downtrend') || 
        item.setupName.includes('Avoid') || 
        item.setupName === 'N/A'
    );
    
    return hasPullback && isBouncing && !isDowntrend && 
           item.price >= 0.25 && item.price <= 4.00 && 
           item.turnover >= 250000 && !item.isCombStock;
});

console.log('=== Triggers on June 30th (Entry Close June 30th) ===');
console.log('Name       | Setup Style | Close Price | Turnover (RM) | Pullback | High 52w');
console.log('-'.repeat(85));

const results = [];
candidates30.forEach(item => {
    const changePct = item.changePct !== undefined ? item.changePct : 0;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    let style = 'SWING PLAY';
    if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
        style = 'EXPLOSIVE';
    } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
        style = 'STAIRCASE';
    }
    
    if (style === 'EXPLOSIVE' || style === 'STAIRCASE') {
        results.push({
            name: item.name,
            style: style,
            price: item.price,
            turnover: item.turnover,
            pullback: pullbackVal,
            high52: item.high52
        });
    }
});

// Sort by style and then by turnover descending
const explosives = results.filter(r => r.style === 'EXPLOSIVE').sort((a,b) => b.turnover - a.turnover);
const staircases = results.filter(r => r.style === 'STAIRCASE').sort((a,b) => b.turnover - a.turnover);

console.log('--- EXPLOSIVES ---');
explosives.forEach((r, idx) => {
    console.log(`${idx+1}. ${r.name.padEnd(10)} | RM ${r.price.toFixed(3)} | Turnover: RM ${r.turnover.toLocaleString(undefined, {maximumFractionDigits:0}).padEnd(12)} | Pullback: ${r.pullback.toFixed(2)}%`);
});

console.log('\n--- STAIRCASES ---');
staircases.forEach((r, idx) => {
    console.log(`${idx+1}. ${r.name.padEnd(10)} | RM ${r.price.toFixed(3)} | Turnover: RM ${r.turnover.toLocaleString(undefined, {maximumFractionDigits:0}).padEnd(12)} | Pullback: ${r.pullback.toFixed(2)}%`);
});
