const fs = require('fs');
const path = require('path');

const file30 = path.join(__dirname, '../history/data_2026-06-30.json');
const data30 = JSON.parse(fs.readFileSync(file30, 'utf8'));
const stocks30 = data30.topVolume || [];

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const changePct = item.changePct !== undefined ? item.changePct : 0;
    
    // 1. Proximity to Floor (Safer Entry)
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    // 2. Floor Strength (Support touches)
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;
    
    // 3. Consolidation Base
    if (item.isConsolidation) score += 2;
    
    // 4. Zon Emas Pullback (ATH / RBS)
    if (pullbackVal <= 5.0) score += 3; // RBS/Near ATH
    else if (pullbackVal <= 12.0) score += 2; // Healthy pullback
    else if (pullbackVal <= 25.0) score += 1;
    
    // 5. SMA Trend Crossover
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    // 6. High volume spike confirmation (Liquidity score booster)
    if (item.turnover >= 5000000) score += 1;
    
    return { score, distToFloor };
}

const dayCandidates = [];
stocks30.forEach(item => {
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const maxPullback = isAboveSma200 ? 40.0 : 30.0;
    
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullback;
    const isBouncing = item.change > 0;
    const isDowntrend = item.setupName && (
        item.setupName.includes('Downtrend') || 
        item.setupName.includes('Avoid') || 
        item.setupName === 'N/A'
    );
    
    const passFilters = hasPullback && 
           isBouncing && 
           !isDowntrend && 
           item.price >= 0.25 && item.price <= 4.00 && 
           item.turnover >= 1500000 && 
           !item.isCombStock;
           
    if (!passFilters) return;
    
    let style = 'SWING PLAY';
    const changePct = item.changePct !== undefined ? item.changePct : 0;
    if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
        style = 'EXPLOSIVE';
    } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
        style = 'STAIRCASE';
    }
    
    if (style === 'EXPLOSIVE' || style === 'STAIRCASE') {
        const { score, distToFloor } = calculateSmartScore(item);
        dayCandidates.push({
            name: item.name,
            style: style,
            price: item.price,
            turnover: item.turnover,
            score: score,
            pullback: pullbackVal,
            touchCount: item.touchCount || 0,
            distToFloor: distToFloor,
            isConsolidation: item.isConsolidation ? 'YA' : 'TIDAK',
            sma50: item.sma50,
            sma200: item.sma200
        });
    }
});

console.log('=== ANALYSIS KANDIDAT PADA 30 JUN ===');

const exps = dayCandidates.filter(c => c.style === 'EXPLOSIVE').sort((a,b) => b.score - a.score || b.turnover - a.turnover);
const stairs = dayCandidates.filter(c => c.style === 'STAIRCASE').sort((a,b) => b.score - a.score || b.turnover - a.turnover);

console.log('\n--- EXPLOSIVES ---');
exps.forEach((r, idx) => {
    console.log(`${idx+1}. ${r.name.padEnd(10)} | Price: RM ${r.price.toFixed(3)} | Score: ${r.score} | Turnover: RM ${(r.turnover/1e6).toFixed(2)}M | Dist Floor: ${r.distToFloor.toFixed(1)}% | PB: ${r.pullback.toFixed(1)}% | touches: ${r.touchCount}`);
});

console.log('\n--- STAIRCASES ---');
stairs.forEach((r, idx) => {
    console.log(`${idx+1}. ${r.name.padEnd(10)} | Price: RM ${r.price.toFixed(3)} | Score: ${r.score} | Turnover: RM ${(r.turnover/1e6).toFixed(2)}M | Dist Floor: ${r.distToFloor.toFixed(1)}% | PB: ${r.pullback.toFixed(1)}% | touches: ${r.touchCount} | Consol: ${r.isConsolidation}`);
});
