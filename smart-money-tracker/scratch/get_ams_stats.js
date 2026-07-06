const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../history/data_2026-07-06.json');
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.topVolume || []);

const ams = list.find(s => s.name.toUpperCase().includes('AMS'));
console.log("=== AMS STATS ON JULY 6 ===");
console.log(JSON.stringify(ams, null, 2));
