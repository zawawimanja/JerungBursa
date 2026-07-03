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

const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

console.log(`🔍 Memeriksa ${files.length} fail arkib sejarah untuk sebarang kemasukan lama EIPOWER & ICENTS...`);

const targetNames = ['AMS', 'EIPOWER', 'ICENTS'];

const results = [];

files.forEach(file => {
    const dateStr = file.replace('data_', '').replace('.json', '');
    const filePath = path.join(HISTORY_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const list = Array.isArray(data) ? data : (data.topVolume || []);

    // Filter all Technique C picks first for this date to see if EIPOWER or ICENTS are inside the Top 6
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

    const topExps = exps.slice(0, 6);
    const topStairs = stairs.slice(0, 6);

    targetNames.forEach(name => {
        const inExps = topExps.find(x => x.name.toUpperCase() === name);
        const inStairs = topStairs.find(x => x.name.toUpperCase() === name);
        
        if (inExps || inStairs) {
            const matched = inExps || inStairs;
            const score = calculateSmartScore(matched);
            const style = inExps ? 'EXPLOSIVE' : 'STAIRCASE';
            results.push({
                date: dateStr,
                name,
                style,
                price: matched.price,
                score
            });
        }
    });
});

console.log('\n=============================================================');
console.log('📅 REKOD SEJARAH KEMASUKAN PENUH EIPOWER & ICENTS (TEKNIK C):');
console.log('=============================================================');
if (results.length === 0) {
    console.log('Tiada sebarang kemasukan sebelum tarikh hari ini.');
} else {
    results.forEach(r => {
        console.log(`- Tarikh: ${r.date} | Saham: ${r.name.padEnd(7)} | Style: ${r.style.padEnd(9)} | Harga: RM ${r.price.toFixed(3)} | Smart Score: ${r.score}`);
    });
}
console.log('=============================================================\n');
