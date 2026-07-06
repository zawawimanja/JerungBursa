const fs = require('fs');
const path = require('path');

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, '../symbol_mappings.json'), 'utf8'));
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

// Mock a stock object for 3REN:
const stock = { name: '3REN' };

const name = stock.name;
const ipoInfo = ipoMap[name.toUpperCase().trim()];
console.log("Name searched:", name.toUpperCase().trim());
console.log("ipoInfo found:", JSON.stringify(ipoInfo));
