const fs = require('fs');
const path = require('path');

const mappingsFile = path.join(__dirname, '../symbol_mappings.json');
const mappings = JSON.parse(fs.readFileSync(mappingsFile, 'utf8'));

const reverseMap = {};
console.log("=== SCANNING FOR DUPLICATE SYMBOLS IN symbol_mappings.json ===");

for (const [name, sym] of Object.entries(mappings)) {
    if (!reverseMap[sym]) {
        reverseMap[sym] = [];
    }
    reverseMap[sym].push(name);
}

let duplicates = 0;
for (const [sym, names] of Object.entries(reverseMap)) {
    if (names.length > 1) {
        duplicates++;
        console.log(`❌ Duplicate for "${sym}": Mapped to multiple names: [${names.join(', ')}]`);
    }
}

console.log(`\nScan completed. Found ${duplicates} duplicate symbols.`);
