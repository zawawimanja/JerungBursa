const fs = require('fs');
const path = require('path');

const liveDataPath = path.join(__dirname, '../live_data.json');
if (!fs.existsSync(liveDataPath)) {
    console.error("❌ No live_data.json found!");
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const list = raw.topVolume || [];

console.log(`📊 TOTAL ITEMS IN LIVE DATA: ${list.length}`);

// Replicate filter logic in index.html for Technique C:
// style is EXPLOSIVE or STAIRCASE, price 0.25 - 4.00, volume filter passes basic criteria (already filtered in reversals list)
// But let's check what passes the reversals scan in index.html first.
// In index.html, the reversals list are items that:
// 1. high52 exists
// 2. pullback >= 0 && pullback <= maxPullback (30% or 40% if above SMA200)
// 3. change > 0 (bouncing)
// 4. not downtrend/avoid
// 5. price 0.25 to 4.00
// 6. turnover >= 250,000
// 7. isCombStock is false
// 8. style is EXPLOSIVE or STAIRCASE

const reversalsList = list.filter(item => {
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
    return hasPullback && 
           isBouncing && 
           !isDowntrend && 
           item.price >= 0.25 && item.price <= 4.00 && 
           item.turnover >= 250000 && 
           !item.isCombStock;
});

console.log(`📈 CALON PULLBACK BOUNCE REVERSALS: ${reversalsList.length}`);

// Filter for Technique C:
const validPicks = reversalsList.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return (style === 'EXPLOSIVE' || style === 'STAIRCASE') && (item.turnover >= 750000);
});

// Separate and sort by turnover descending
const exps = validPicks.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'EXPLOSIVE';
});

const stairs = validPicks.filter(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'STAIRCASE';
});

const sortFn = (a, b) => b.turnover - a.turnover;
exps.sort(sortFn);
stairs.sort(sortFn);

const topExps = exps.slice(0, 6);
const topStairs = stairs.slice(0, 6);

console.log('\n🚀 TOP 6 EXPLOSIVE TODAY:');
console.log('='.repeat(80));
topExps.forEach((item, idx) => {
    console.log(`${idx+1}. ${item.name.padEnd(10)} | Price: RM ${item.price.toFixed(3)} | Change: +${item.changePct.toFixed(2)}% | Turnover: RM ${(item.turnover/1e6).toFixed(2)}M`);
});

console.log('\n🪜 TOP 6 STAIRCASE TODAY:');
console.log('='.repeat(80));
topStairs.forEach((item, idx) => {
    console.log(`${idx+1}. ${item.name.padEnd(10)} | Price: RM ${item.price.toFixed(3)} | Change: +${item.changePct.toFixed(2)}% | Turnover: RM ${(item.turnover/1e6).toFixed(2)}M`);
});
