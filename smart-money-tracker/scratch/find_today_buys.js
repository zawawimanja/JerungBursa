const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
if (!fs.existsSync(liveDataFile)) {
    console.error("live_data.json not found!");
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

// Filter for BUY signals
const buyCandidates = currentData.filter(s => s.signal === 'buy');

console.log(`=== TODAY'S BUY SIGNALS (${buyCandidates.length} counters found) ===`);

const mapped = buyCandidates.map(s => {
    const floor = s.floorLow || (s.price * 0.95);
    const dist = ((s.price - floor) / floor) * 100;
    const stopLoss = floor * 0.97; // -3% below floor Low
    
    // Determine priority score based on Grade, VVIP status and distance to floor
    let priority = 0;
    if (s.ipoGrade === 'A') priority += 100;
    else if (s.ipoGrade === 'B') priority += 50;
    
    if (s.isVvip) priority += 30;
    
    // Proximity to floor is better (smaller distance is higher priority)
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

// Sort by priority descending
mapped.sort((a, b) => b.priority - a.priority);

console.table(mapped.map(m => {
    const { priority, ...rest } = m;
    return rest;
}));
