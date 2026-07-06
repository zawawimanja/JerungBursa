const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../history/data_2026-07-06.json');
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.topVolume || []);

const elridge = list.find(s => s.name.toUpperCase().includes('ELRIDGE'));
console.log("=== ELRIDGE PROFILE ON JULY 6 ===");
if (elridge) {
    console.log(JSON.stringify(elridge, null, 2));
} else {
    console.log("NOT FOUND in data_2026-07-06.json!");
}
