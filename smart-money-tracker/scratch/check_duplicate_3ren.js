const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

const matches = currentData.filter(item => item.name.toUpperCase().includes('3REN'));
console.log(`=== FOUND ${matches.length} ENTRIES MATCHING '3REN' ===`);
matches.forEach((m, idx) => {
    console.log(`\nEntry #${idx + 1}:`, JSON.stringify(m, null, 2));
});
