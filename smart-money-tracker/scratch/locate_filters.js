const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../index.html');
const lines = fs.readFileSync(indexFile, 'utf8').split('\n');

console.log("=== LOCATING FILTERS AND DROPDOWNS IN index.html ===");
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('ipoAgeFilter') || lines[i].includes('id="strictEntryFilter"')) {
        console.log(`Line ${i+1}: ${lines[i].trim()}`);
        const start = Math.max(0, i - 10);
        const end = Math.min(lines.length - 1, i + 10);
        for (let j = start; j <= end; j++) {
            console.log(`  [${j+1}] ${lines[j]}`);
        }
    }
}
