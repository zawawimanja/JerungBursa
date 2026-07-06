const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';

if (fs.existsSync(ipoDataPath)) {
    const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));
    const hegroup = data.find(item => {
        const companyName = (item.companyName || '').toUpperCase();
        const symbol = (item.symbol || '').toUpperCase();
        return companyName.includes('HEGROUP') || symbol.includes('HEGROUP') || companyName.includes('HE GROUP') || symbol.includes('HE GROUP');
    });
    console.log("=== HEGROUP IN DESKTOP data.json ===");
    console.log(JSON.stringify(hegroup, null, 2));
} else {
    console.log("Desktop data.json does NOT exist at:", ipoDataPath);
}
