const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';

if (!fs.existsSync(ipoDataPath)) {
    console.error("Desktop data.json not found!");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

let patchedCount = 0;

data.forEach(item => {
    if (item.id === 'adnex') {
        item.symbol = 'ADNEX';
        patchedCount++;
        console.log("Patched adnex symbol to 'ADNEX'");
    }
    if (item.id === 'alpha-ivf') {
        item.symbol = 'ALPHA';
        item.listingDate = '22-Mar-2024';
        patchedCount++;
        console.log("Patched alpha-ivf symbol to 'ALPHA' and listingDate to '22-Mar-2024'");
    }
    if (item.id === 'lpbhd') {
        item.symbol = 'L&PBHD';
        item.listingDate = '03-Jan-2023';
        patchedCount++;
        console.log("Patched lpbhd symbol to 'L&PBHD' and listingDate to '03-Jan-2023'");
    }
});

if (patchedCount > 0) {
    fs.writeFileSync(ipoDataPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Successfully patched database! Saved ${patchedCount} records.`);
} else {
    console.log("No matching records to patch.");
}
