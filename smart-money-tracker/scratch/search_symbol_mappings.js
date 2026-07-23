const fs = require('fs');
const file = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\symbol_mappings.json";
const mappings = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log("Mappings containing SRKK:");
Object.keys(mappings).forEach(k => {
    if (k.toUpperCase().includes('SRKK')) {
        console.log(`  "${k}": "${mappings[k]}"`);
    }
});
