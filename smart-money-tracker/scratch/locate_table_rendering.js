const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../index.html');
const lines = fs.readFileSync(indexFile, 'utf8').split('\n');

console.log("=== SEARCHING FOR TABLE HEADERS (thead) IN index.html ===");
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('hybridPicksTableBody') || lines[i].includes('Harga Beli') || lines[i].includes('Lantai Sokongan')) {
        console.log(`Line ${i+1}: ${lines[i].trim()}`);
        const start = Math.max(0, i - 15);
        const end = Math.min(lines.length - 1, i + 15);
        for (let j = start; j <= end; j++) {
            console.log(`  [${j+1}] ${lines[j]}`);
        }
        break;
    }
}

console.log("\n=== SEARCHING FOR ROW HTML GENERATION IN renderTrendRiders ===");
let rowGenFound = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const tr = document.createElement') || lines[i].includes('tr.innerHTML =')) {
        if (i > 1300) { // Render function area
            rowGenFound = true;
            console.log(`Line ${i+1}: ${lines[i].trim()}`);
            const start = Math.max(0, i - 5);
            const end = Math.min(lines.length - 1, i + 25);
            for (let j = start; j <= end; j++) {
                console.log(`  [${j+1}] ${lines[j]}`);
            }
            break;
        }
    }
}
