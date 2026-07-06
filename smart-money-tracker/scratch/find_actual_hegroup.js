const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';

if (fs.existsSync(ipoDataPath)) {
    const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));
    const matches = data.filter(item => {
        const companyName = (item.companyName || '').toUpperCase();
        const symbol = (item.symbol || '').toUpperCase();
        return companyName.includes('HE') || symbol.includes('HE');
    });
    console.log("=== ALL ENTRIES MATCHING 'HE' IN data.json ===");
    matches.forEach(m => {
        console.log(`ID: ${m.id} | Name: ${m.companyName} | Symbol: ${m.symbol} | Date: ${m.listingDate} | Year: ${m.year}`);
    });
} else {
    console.log("Desktop data.json does NOT exist.");
}
