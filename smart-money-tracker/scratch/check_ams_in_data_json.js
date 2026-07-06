const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';

if (fs.existsSync(ipoDataPath)) {
    const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));
    console.log("=== SEARCHING 'AMS' IN DESKTOP data.json ===");
    data.forEach(item => {
        const companyName = (item.companyName || '').toUpperCase();
        const symbol = (item.symbol || '').toUpperCase();
        const id = (item.id || '').toUpperCase();
        if (companyName.includes('AMS') || symbol.includes('AMS') || id.includes('AMS')) {
            console.log(JSON.stringify(item, null, 2));
        }
    });
} else {
    console.log("Desktop data.json does NOT exist.");
}
