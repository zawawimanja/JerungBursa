const fs = require('fs');
const path = require('path');

const ipoDataPath = '/home/awi/Desktop/ipohunterv2/data.json';
const freshIpos = [
    'SKYECHIP', 'PENTECH', 'SUM', 'ELSA', 'AMBEST', 'AMS',
    'EIPOWER', 'ISF', 'KEEMING', 'TEAMSTR', 'MMCS', 'GDGROUP',
    'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE'
];

if (fs.existsSync(ipoDataPath)) {
    const ipos = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));
    console.log("=== IPO LISTING YEARS IN ipohunterv2/data.json ===");
    
    freshIpos.forEach(sym => {
        const found = ipos.find(ipo => ipo.symbol && ipo.symbol.toUpperCase().trim() === sym);
        if (found) {
            console.log(`${sym}: year=${found.year}, date=${found.listingDate}, status=${found.status}`);
        } else {
            console.log(`${sym}: NOT FOUND IN DATABASE`);
        }
    });
} else {
    console.log("Database not found at " + ipoDataPath);
}
