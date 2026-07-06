const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

const mttsl = currentData.find(s => s.name === 'MTTSL');
console.log("=== MTTSL DATA IN live_data.json ===");
if (mttsl) {
    console.log(JSON.stringify(mttsl, null, 2));
} else {
    console.log("MTTSL NOT FOUND!");
}
