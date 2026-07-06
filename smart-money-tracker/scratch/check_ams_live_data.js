const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

const ams = currentData.find(s => s.name === 'AMS');
console.log("=== AMS DATA IN live_data.json ===");
if (ams) {
    const floor = ams.floorLow || 0;
    const dist = floor ? ((ams.price - floor) / floor) * 100 : 0;
    console.log(JSON.stringify(ams, null, 2));
    console.log(`Calculated Distance to Floor: ${dist.toFixed(2)}%`);
} else {
    console.log("AMS NOT FOUND IN live_data.json!");
}
