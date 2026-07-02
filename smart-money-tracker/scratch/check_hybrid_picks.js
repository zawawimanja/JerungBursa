const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'live_data.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const list = Array.isArray(data) ? data : (data.topVolume || []);

function calculateSmartScore(item) {
    let score = 5;
    const floor = item.floorLow || (item.price * 0.97);
    const dist = ((item.price - floor) / floor) * 100;
    
    if (dist <= 1.5) score += 3;
    else if (dist <= 4.0) score += 1.5;
    else if (dist <= 8.0) score += 0.5;
    
    if (item.isConsolidation) score += 2;
    if (item.hasLowerWickRejection) score += 1;
    if (item.touchCount && item.touchCount >= 3) score += 1;
    if (item.pullback && item.pullback <= 10.0) score += 1;
    
    return score;
}

const picks = [];
list.forEach(item => {
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    
    const isVvip = item.isVvip;
    const score = calculateSmartScore(item);
    
    if ((style === 'EXPLOSIVE' || style === 'STAIRCASE') && item.turnover >= 750000) {
        picks.push({
            name: item.name,
            style,
            price: item.price,
            floorLow: item.floorLow || (item.price * 0.97),
            turnover: item.turnover,
            isVvip,
            score
        });
    }
});

// Sort
const renderSortFn = (a, b) => {
    const isVvipA = (a.isVvip && a.score >= 8) ? 1 : 0;
    const isVvipB = (b.isVvip && b.score >= 8) ? 1 : 0;
    if (isVvipB !== isVvipA) return isVvipB - isVvipA;
    if (b.score !== a.score) return b.score - a.score;
    return b.turnover - a.turnover;
};

picks.sort(renderSortFn);

console.log("=== ACTUAL TABLE RENDERING (TOP 6) ===");
picks.slice(0, 6).forEach((item, index) => {
    const sl = item.floorLow * 0.97;
    console.log(`${index + 1}. ${item.name}:`);
    console.log(`   Price: RM ${item.price.toFixed(3)}`);
    console.log(`   Floor: RM ${item.floorLow.toFixed(3)}`);
    console.log(`   Stop Loss: RM ${sl.toFixed(3)}`);
    console.log(`   Smart Score: ${item.score}`);
    console.log(`   VVIP: ${item.isVvip}`);
});
