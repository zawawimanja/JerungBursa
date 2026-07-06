const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

const targets = [
    'KEEMING', 'HKB', 'SUM', 'MMCS', 'AMS', 'AMBEST', 'MNHLDG', 'ICENTS', 'ICENT', 'DNEX'
];

console.log("=== SAHAM CATEGORY LOOKUP ===");

// We will check data.json and fallback sectors/mappings
const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, '../symbol_mappings.json'), 'utf8'));

targets.forEach(name => {
    // Look up in data.json
    const record = data.find(r => {
        const cleanRecName = (r.companyName || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const cleanRecSym = (r.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const cleanTarget = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return cleanRecSym.includes(cleanTarget) || cleanRecName.includes(cleanTarget) || cleanTarget.includes(cleanRecSym);
    });

    if (record) {
        const year = parseInt(record.year) || (record.listingDate ? parseInt(record.listingDate.split('-')[2]) : 0);
        let category = 'Non-IPO (Pre-2019)';
        if (year >= 2025) category = '✨ Fresh IPO (2025-2026)';
        else if (year >= 2019) category = '🧱 Mature IPO (2019-2024)';
        
        console.log(`- ${name.toUpperCase().padEnd(10)} | Listing Year: ${year || 'Unknown'} | Category: ${category} | IPO Price: RM ${record.price || 'N/A'}`);
    } else {
        // Fallback for Non-IPOs that might not be in data.json (like DNEX)
        let year = 'Pre-2019';
        let category = '🏢 Non-IPO (Pre-2019)';
        
        // Let's do special checks for known non-IPOs
        if (name.toUpperCase() === 'DNEX') {
            console.log(`- DNEX       | Listing Year: 2005 (Legacy) | Category: 🏢 Non-IPO (Pre-2019) | IPO Price: N/A`);
        } else if (name.toUpperCase() === 'ICENTS' || name.toUpperCase() === 'ICENT') {
            // Let's see if it's in mappings
            const mappingVal = mappings[name.toUpperCase()] || mappings['ICENT'] || mappings['ICENTS'];
            console.log(`- ${name.toUpperCase().padEnd(10)} | Listing Year: Pre-2019 | Category: 🏢 Non-IPO (Pre-2019) | Mapping: ${mappingVal || 'None'}`);
        } else {
            console.log(`- ${name.toUpperCase().padEnd(10)} | NOT FOUND IN DATABASE (Likely Non-IPO)`);
        }
    }
});
