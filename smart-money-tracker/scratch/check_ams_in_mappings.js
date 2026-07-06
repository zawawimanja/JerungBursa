const fs = require('fs');
const path = require('path');

const mappingsFile = path.join(__dirname, '../symbol_mappings.json');
const mappings = JSON.parse(fs.readFileSync(mappingsFile, 'utf8'));

console.log("=== MAPPINGS CONTAINING 'AMS' OR '0302' ===");
for (const [name, sym] of Object.entries(mappings)) {
    if (name.includes('AMS') || sym.includes('0302')) {
        console.log(`- "${name}": "${sym}"`);
    }
}
