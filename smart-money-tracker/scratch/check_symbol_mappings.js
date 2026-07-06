const fs = require('fs');
const path = require('path');

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, '../symbol_mappings.json'), 'utf8'));
console.log("=== 3REN IN symbol_mappings.json ===");
console.log("3REN key:", mappings["3REN"]);
console.log("3REN [NS] key:", mappings["3REN [NS]"]);
console.log("Case-insensitive search:");
Object.keys(mappings).forEach(k => {
    if (k.toUpperCase().includes('3REN')) {
        console.log(`Key: "${k}" | Value: "${mappings[k]}"`);
    }
});
