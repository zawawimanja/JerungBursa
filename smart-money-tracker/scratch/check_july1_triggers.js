const fs = require('fs');
const path = require('path');

const file01 = path.join(__dirname, '../history/data_2026-07-01.json');

if (!fs.existsSync(file01)) {
    console.error("❌ Fail data_2026-07-01.json tidak dijumpai.");
    process.exit(1);
}

const data01 = JSON.parse(fs.readFileSync(file01, 'utf8'));
const stocks01 = Array.isArray(data01) ? data01 : (data01.topVolume || []);

const candidates01 = stocks01.filter(item => {
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

console.log('=== TRiggers on July 1st (Entry Close July 1st) ===');
console.log('Name       | Setup Style | Close Price | Turnover (RM) | Pullback | High 52w');
console.log('-'.repeat(85));

candidates01.forEach(item => {
    const changePct = item.changePct !== undefined ? item.changePct : 0;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    let style = 'SWING PLAY';
    if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
        style = 'EXPLOSIVE';
    } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
        style = 'STAIRCASE';
    }
    
    if (style === 'EXPLOSIVE' || style === 'STAIRCASE') {
        console.log(
            `${item.name.padEnd(10)} | ` +
            `${style.padEnd(11)} | ` +
            `RM ${item.price.toFixed(3).padEnd(8)} | ` +
            `RM ${item.turnover.toLocaleString(undefined, {maximumFractionDigits:0}).padEnd(12)} | ` +
            `${pullbackVal.toFixed(2)}%`.padEnd(8) + ' | ' +
            `RM ${item.high52.toFixed(3)}`
        );
    }
});
