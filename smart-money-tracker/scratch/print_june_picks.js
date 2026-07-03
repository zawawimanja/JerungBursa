const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '../history');

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
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
    
    return score;
}

function isSleepingOrAvoidStock(item) {
    if (!item) return true;
    if (item.isCombStock) return true;
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
    return false;
}

const dates = ['2026-06-24', '2026-06-25', '2026-06-26', '2026-06-29', '2026-06-30'];

dates.forEach(date => {
    const file = `data_${date}.json`;
    const filePath = path.join(HISTORY_DIR, file);
    if (!fs.existsSync(filePath)) return;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const list = Array.isArray(data) ? data : (data.topVolume || []);

    const hybridPicks = list.filter(item => {
        if (!item.high52) return false;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
        const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
        const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
        if (!hasPullback) return false;
        if (isSleepingOrAvoidStock(item)) return false;
        if (item.price < 0.25 || item.price > 4.00) return false;
        if (item.turnover < 750000) return false;
        if (calculateSmartScore(item) < 8) return false;

        const pct = item.changePct !== undefined ? item.changePct : item.change;
        const pb = item.pullback !== null ? item.pullback : 0;
        const style = item.setupStyle || (
            pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : 'STAIRCASE'
        );
        return style === 'EXPLOSIVE' || style === 'STAIRCASE';
    });

    const renderSortFn = (a, b) => {
        const scoreA = calculateSmartScore(a);
        const scoreB = calculateSmartScore(b);
        const isVvipA = (a.isVvip && scoreA >= 8) ? 1 : 0;
        const isVvipB = (b.isVvip && scoreB >= 8) ? 1 : 0;
        if (isVvipB !== isVvipA) return isVvipB - isVvipA;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.turnover - a.turnover;
    };

    const exps = hybridPicks.filter(item => {
        const pct = item.changePct !== undefined ? item.changePct : item.change;
        const pb = item.pullback !== null ? item.pullback : 0;
        return (pct >= 5.0 || (pct >= 3.5 && pb > 5.0));
    });
    const stairs = hybridPicks.filter(item => {
        const pct = item.changePct !== undefined ? item.changePct : item.change;
        const pb = item.pullback !== null ? item.pullback : 0;
        return !(pct >= 5.0 || (pct >= 3.5 && pb > 5.0));
    });

    exps.sort(renderSortFn);
    stairs.sort(renderSortFn);

    console.log(`\n📅 SENARAI PICKS (TEKNIK C) PADA TARIKH: ${date}`);
    console.log('='.repeat(60));
    console.log('Nama       | Style     | Score | Price    | Turnover');
    console.log('-'.repeat(60));
    
    const topHybrid = [...exps.slice(0, 6), ...stairs.slice(0, 6)];
    topHybrid.forEach(p => {
        const pct = p.changePct !== undefined ? p.changePct : p.change;
        const pb = p.pullback !== null ? p.pullback : 0;
        const style = (pct >= 5.0 || (pct >= 3.5 && pb > 5.0)) ? 'EXPLOSIVE' : 'STAIRCASE';
        const score = calculateSmartScore(p);
        console.log(`${p.name.padEnd(10)} | ${style.padEnd(9)} | ${String(score).padStart(5)} | RM ${p.price.toFixed(3)} | RM ${(p.turnover/1e6).toFixed(2)}M`);
    });
    console.log('='.repeat(60));
});
