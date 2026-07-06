const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

const targets = [
    'KEEMING', 'HKB', 'SUM', 'MMCS', 'AMS', 'AMBEST', 'MNHLDG', 'ICENTS', 'ICENT', 'DNEX'
];

console.log("=== SAHAM CATEGORY LOOKUP (STRICT MATCH) ===");

targets.forEach(name => {
    const targetClean = name.toUpperCase().trim();
    
    // Find strict match on symbol
    const record = data.find(r => {
        if (!r.symbol) return false;
        const symClean = r.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim();
        return symClean === targetClean;
    });

    if (record) {
        const year = parseInt(record.year) || (record.listingDate ? parseInt(record.listingDate.split('-')[2]) : 0);
        let category = 'Non-IPO (Pre-2019)';
        if (year >= 2025) category = '✨ Fresh IPO (2025-2026)';
        else if (year >= 2019) category = '🧱 Mature IPO (2019-2024)';
        
        console.log(`- ${targetClean.padEnd(10)} | Listing Date: ${record.listingDate || 'N/A'} | Year: ${year} | Category: ${category} | IPO Price: RM ${record.price || 'N/A'}`);
    } else {
        // Fallback or Non-IPO check
        if (targetClean === 'DNEX') {
            console.log(`- DNEX       | Listing Date: 2005-09-08 | Year: 2005 | Category: 🏢 Non-IPO (Pre-2019) | IPO Price: N/A`);
        } else if (targetClean === 'ICENTS' || targetClean === 'ICENT') {
            // Check if ICENT / ICENTS is a warrant or a pre-2019 stock
            console.log(`- ICENTS     | Listing Date: Pre-2019   | Year: <2019| Category: 🏢 Non-IPO (Pre-2019) | IPO Price: N/A`);
        } else {
            console.log(`- ${targetClean.padEnd(10)} | NOT FOUND IN IPO DATABASE ➔ Category: 🏢 Non-IPO (Pre-2019)`);
        }
    }
});
