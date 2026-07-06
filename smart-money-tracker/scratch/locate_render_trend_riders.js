const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../index.html');
const lines = fs.readFileSync(indexFile, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function renderTrendRiders') || lines[i].includes('renderTrendRiders() {') || lines[i].includes('renderTrendRiders =')) {
        console.log(`Line ${i+1}: ${lines[i].trim()}`);
        for (let j = i; j < i + 50; j++) {
            console.log(`  [${j+1}] ${lines[j]}`);
        }
        break;
    }
}
