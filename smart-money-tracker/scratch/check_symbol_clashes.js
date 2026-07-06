const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';

if (!fs.existsSync(ipoDataPath)) {
    console.error("Desktop data.json not found!");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

// Group by clean symbol
const symbolMap = {};
data.forEach(item => {
    if (item.symbol) {
        const cleanSymbol = item.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim();
        if (!symbolMap[cleanSymbol]) {
            symbolMap[cleanSymbol] = [];
        }
        symbolMap[cleanSymbol].push(item);
    }
});

console.log("=== CHECKING FOR DUPLICATE SYMBOLS IN data.json ===");
let duplicateCount = 0;
Object.keys(symbolMap).forEach(sym => {
    const records = symbolMap[sym];
    if (records.length > 1) {
        duplicateCount++;
        console.log(`\n⚠️ Duplicate Clean Symbol: "${sym}" (${records.length} records found)`);
        records.forEach(r => {
            console.log(`  ID: "${r.id}" | Company: "${r.companyName}" | Year: ${r.year} | Price: RM ${r.price} | Status: "${r.status}"`);
        });
    }
});

if (duplicateCount === 0) {
    console.log("✅ No duplicate symbols found in data.json!");
}

console.log("\n=== INSPECTING FOR POTENTIAL SYMBOL TYPOS OR MISSING SYMBOLS ===");
// List records where ID does not match symbol (which can be a sign of typo, e.g. ID is cheeding but symbol is HEGROUP)
let mismatchCount = 0;
data.forEach(r => {
    if (r.symbol && r.id) {
        const cleanSymbol = r.symbol.replace(/\[.*?\]/g, '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const cleanId = r.id.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        
        // If ID does not contain the symbol or vice versa, and it's not a standard abbreviation
        if (!cleanId.includes(cleanSymbol) && !cleanSymbol.includes(cleanId) && cleanId !== 'teamstr' && cleanId !== 'ramssol') {
            mismatchCount++;
            console.log(`🔍 ID Mismatch: ID="${r.id}" | Symbol="${r.symbol}" | Company="${r.companyName}" | ListingDate="${r.listingDate}"`);
        }
    }
});

if (mismatchCount === 0) {
    console.log("✅ No suspicious ID-Symbol mismatches found!");
}
