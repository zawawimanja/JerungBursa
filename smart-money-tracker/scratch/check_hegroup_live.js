const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

const hegroup = currentData.find(s => s.name === 'HEGROUP');
console.log("=== UPDATED HEGROUP IN live_data.json ===");
if (hegroup) {
    console.log(JSON.stringify(hegroup, null, 2));
} else {
    console.log("HEGROUP NOT FOUND!");
}
