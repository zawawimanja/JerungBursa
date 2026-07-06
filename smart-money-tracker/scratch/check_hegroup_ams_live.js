const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

['HEGROUP', 'AMS'].forEach(name => {
    const s = currentData.find(item => item.name === name);
    console.log(`\n=== ${name} DATA IN live_data.json ===`);
    if (s) {
        const floor = s.floorLow || 0;
        const dist = floor ? ((s.price - floor) / floor) * 100 : 0;
        console.log(`Price: RM ${s.price.toFixed(3)} | Floor: RM ${floor.toFixed(3)} | Dist: ${dist.toFixed(2)}%`);
        console.log(`Signal: "${s.signal.toUpperCase()}" | Reason: "${s.reason}"`);
    } else {
        console.log(`${name} NOT FOUND!`);
    }
});
