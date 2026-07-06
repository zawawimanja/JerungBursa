const fs = require('fs');
const path = require('path');

const histFile = path.join(__dirname, '../history/data_2026-07-02.json');
const raw = JSON.parse(fs.readFileSync(histFile, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

const oxb = data.find(s => s.name === 'OXB');

console.log("=== OXB DATA FOR JULY 2ND, 2026 ===");
if (oxb) {
    console.log(JSON.stringify(oxb, null, 2));
} else {
    console.log("OXB was NOT in the July 2nd history file!");
}
