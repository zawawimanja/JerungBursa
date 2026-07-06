const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';

if (fs.existsSync(ipoDataPath)) {
    const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));
    const m = data.find(item => {
        const companyName = (item.companyName || '').toUpperCase();
        const symbol = (item.symbol || '').toUpperCase();
        return companyName.includes('3REN') || symbol.includes('3REN');
    });
    console.log("=== 3REN IN DESKTOP data.json ===");
    console.log(JSON.stringify(m, null, 2));
} else {
    console.log("Desktop data.json does NOT exist.");
}
