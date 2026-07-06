const fs = require('fs');
const path = require('path');

const getIpoDataPath = () => {
    const candidatePaths = [
        path.join(__dirname, '../../../ipo/data.json'),
        path.join(__dirname, '../../../ipohunterv2/data.json'),
        '/home/awi/Desktop/ipohunterv2/data.json',
        'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json'
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) return p;
    }
    return candidatePaths[0];
};
const ipoDataPath = getIpoDataPath();
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
