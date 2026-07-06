const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

const buyCandidates = currentData.filter(s => s.signal === 'buy');

const mapped = buyCandidates.map(s => {
    const floor = s.floorLow || (s.price * 0.95);
    const dist = ((s.price - floor) / floor) * 100;
    const stopLoss = floor * 0.97;
    
    let priority = 0;
    if (s.ipoGrade === 'A') priority += 100;
    else if (s.ipoGrade === 'B') priority += 50;
    
    if (s.isVvip) priority += 30;
    priority += (15.0 - dist);

    return {
        name: s.name,
        grade: s.ipoGrade || 'Unrated',
        isVvip: s.isVvip ? '🔥 VVIP' : 'Normal',
        sector: s.sector || 'Others',
        setup: s.setupName || 'Setup',
        price: `RM ${s.price.toFixed(3)}`,
        floor: `RM ${floor.toFixed(3)}`,
        distToFloor: `${dist.toFixed(1)}%`,
        stopLoss: `RM ${stopLoss.toFixed(3)}`,
        turnover: `RM ${(s.turnover / 1000000).toFixed(2)}M`,
        priority
    };
});

mapped.sort((a, b) => b.priority - a.priority);

console.log("=== TOP 12 BEST PRIORITIZED BUY OPPORTUNITIES FOR TODAY ===");
console.table(mapped.slice(0, 12).map(m => {
    const { priority, ...rest } = m;
    return rest;
}));
