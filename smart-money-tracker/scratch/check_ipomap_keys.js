const fs = require('fs');
const path = require('path');

const ipoDataFilePath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';

const ipoMap = {};
if (fs.existsSync(ipoDataFilePath)) {
    const ipoList = JSON.parse(fs.readFileSync(ipoDataFilePath, 'utf8'));
    ipoList.forEach(ipo => {
        if (ipo.symbol) {
            const cleanSymbol = ipo.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim();
            const listingYear = parseInt(ipo.year) || (ipo.listingDate ? parseInt(ipo.listingDate.split('-')[2]) : 0);
            ipoMap[cleanSymbol] = {
                grade: ipo.predictedGrade || 'Unrated',
                year: listingYear,
                ipoPrice: ipo.price
            };
        }
    });
}

console.log("=== IPOMAP KEYS CONTAINING '3REN' or 'HEGROUP' ===");
Object.keys(ipoMap).forEach(k => {
    if (k.includes('3REN') || k.includes('HEGROUP')) {
        console.log(`Key: "${k}" | Value:`, JSON.stringify(ipoMap[k]));
    }
});
