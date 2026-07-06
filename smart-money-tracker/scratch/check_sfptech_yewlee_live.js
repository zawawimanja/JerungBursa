const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

const targets = ['SFPTECH', 'YEWLEE'];

targets.forEach(name => {
    // Try both exact and partial matches
    const s = currentData.find(item => {
        const itemClean = item.name.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
        const targetClean = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return itemClean.includes(targetClean) || targetClean.includes(itemClean);
    });

    console.log(`\n=== TODAY'S SCAN FOR: ${name} ===`);
    if (s) {
        console.log(JSON.stringify(s, null, 2));
        const floor = s.floorLow || (s.price * 0.95);
        const dist = ((s.price - floor) / floor) * 100;
        const sl = floor * 0.97;
        console.log(`- Current Price: RM ${s.price.toFixed(3)}`);
        console.log(`- Change: ${s.change >= 0 ? '+' : ''}${(s.changePct || 0).toFixed(2)}%`);
        console.log(`- Support Floor: RM ${floor.toFixed(3)}`);
        console.log(`- Distance to Floor: ${dist.toFixed(2)}%`);
        console.log(`- Safe Stop Loss (-3% below floor): RM ${sl.toFixed(3)}`);
    } else {
        console.log("NOT FOUND IN TODAY'S MARKET DATA!");
    }
});
