const fs = require('fs');
const path = require('path');

const histFile = path.join(__dirname, '../history/data_2026-07-02.json');
const raw = JSON.parse(fs.readFileSync(histFile, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

const matches = data.filter(s => s.name.toUpperCase().includes('AMS'));

console.log(`=== OCCURRENCES OF 'AMS' IN JULY 2ND HISTORY DATA ===`);
console.log(`Found ${matches.length} matches:`);
matches.forEach((s, idx) => {
    console.log(`\nMatch #${idx + 1}:`);
    console.log(`- Name: "${s.name}"`);
    console.log(`- Sector: "${s.sector}"`);
    console.log(`- Price: RM ${s.price}`);
    console.log(`- Signal: "${s.signal}"`);
    console.log(`- Turnover: RM ${s.turnover}`);
    console.log(`- ipoGrade: "${s.ipoGrade}"`);
});
