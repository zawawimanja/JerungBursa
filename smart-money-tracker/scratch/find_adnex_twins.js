const fs = require('fs');
const pathLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";

if (!fs.existsSync(pathLive)) {
    console.log('live_data.json not found');
    process.exit(1);
}

const live = JSON.parse(fs.readFileSync(pathLive, 'utf8'));

console.log('=== SEARCHING FOR ADNEX TWINS (0396.KL) TODAY ===');
console.log('Criteria: under RM 1.00, high turnover today (>RM500k), solid base (touches >= 3), isCombStock is true (system flags avoid but volume wakes up)');

const results = [];
(live.topVolume || []).forEach(s => {
    if (s.price >= 1.00 || s.price <= 0) return;
    if (s.name === 'ADNEX') return; // skip itself
    
    // Check if it has a volume spike today but historical comb-stock flag
    if (s.isCombStock && s.turnover >= 500000) {
        const floorDist = s.floorLow ? ((s.price - s.floorLow) / s.floorLow * 100) : null;
        results.push({
            name: s.name,
            price: s.price,
            setupStyle: s.setupStyle,
            turnover: s.turnover,
            touches: s.touchCount,
            floorDist: floorDist,
            reason: s.reason,
            type: 'Comb Stock Waking Up'
        });
    }
});

console.log(`\nFound ${results.length} "Sleeping Giants" waking up today:`);
results.forEach(res => {
    console.log(`\n- ${res.name} (RM ${res.price.toFixed(3)}) | Setup: ${res.setupStyle}`);
    console.log(`  Today's Turnover: RM ${(res.turnover/1000000).toFixed(2)} Million`);
    console.log(`  Floor Touches: ${res.touches} | Dist to Floor: ${res.floorDist ? res.floorDist.toFixed(2) + '%' : 'N/A'}`);
    console.log(`  System Flagged Reason: ${res.reason}`);
});

// Let's also search for general Early Spring matches today
console.log('\n\n=== GENERAL EARLY SPRING (ES) MATCHES TODAY ===');
const esMatches = [];
(live.topVolume || []).forEach(s => {
    if (s.price >= 1.00 || s.price <= 0) return;
    
    const floor = s.floorLow || (s.price * 0.97);
    const distToFloor = ((s.price - floor) / floor) * 100;
    const touches = s.touchCount || 0;
    
    if (s.isCombStock) return; // for clean matches
    
    if (s.openPrice) {
        const distToOpen = ((s.price - s.openPrice) / s.openPrice) * 100;
        const isTriggered = s.price >= s.openPrice;
        if (isTriggered && distToOpen <= 5.0 && touches >= 1 && s.signal === 'buy') {
            esMatches.push(s);
        }
    }
});

esMatches.forEach(res => {
    console.log(`- ${res.name} (RM ${res.price.toFixed(3)}) | Setup: ${res.setupStyle} | Dist to Open: +${(((res.price - res.openPrice)/res.openPrice)*100).toFixed(2)}% | Touches: ${res.touchCount}`);
});
