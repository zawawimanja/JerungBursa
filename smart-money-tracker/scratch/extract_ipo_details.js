const fs = require('fs');
const path = require('path');

const ipoPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
if (!fs.existsSync(ipoPath)) {
    console.error("IPO data file not found!");
    process.exit(1);
}

const ipoData = JSON.parse(fs.readFileSync(ipoPath, 'utf8'));

const targets = ['KEEMING', 'AMS', 'HKB', 'MMCS', 'EIPOWER', 'AMBEST', 'ICENTS', 'OGX', 'CBHB', 'SUM', 'ELSA'];

console.log("=== IPO METADATA DETAILS ===");
targets.forEach(t => {
    const match = ipoData.find(item => item && (
        (item.symbol && item.symbol.toUpperCase() === t) ||
        (item.companyName && item.companyName.toUpperCase().includes(t))
    ));
    if (match) {
        console.log(`${t}: Date = ${match.listingDate || match.openingDate || 'N/A'}, Price = ${match.price || 'N/A'}, FullName = ${match.companyName}`);
    } else {
        console.log(`${t}: NOT FOUND in ipo/data.json`);
    }
});
