const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

const s = currentData.find(item => item.name === '3REN');
console.log("=== 3REN IN live_data.json ===");
if (s) {
    console.log(JSON.stringify(s, null, 2));
} else {
    console.log("3REN NOT FOUND!");
}
