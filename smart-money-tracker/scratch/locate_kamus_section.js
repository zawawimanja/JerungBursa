const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../index.html');
const lines = fs.readFileSync(indexFile, 'utf8').split('\n');

console.log("=== LOCATING KAMUS KATEGORI SAHAM IN index.html ===");
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Kamus Kategori Saham') || lines[i].includes('Kriteria Umur IPO') || lines[i].includes('Fresh IPO (Listing')) {
        console.log(`Line ${i+1}: ${lines[i].trim()}`);
        const start = Math.max(0, i - 5);
        const end = Math.min(lines.length - 1, i + 25);
        for (let j = start; j <= end; j++) {
            console.log(`  [${j+1}] ${lines[j]}`);
        }
        break;
    }
}
