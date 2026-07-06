const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

const targetIds = ['adnex', 'alpha-ivf', 'lpbhd', 'northeast', 'saliran--ns-', 'saliran-group'];

targetIds.forEach(id => {
    const record = data.find(r => r.id === id);
    console.log(`\n=== RECORD FOR ID: "${id}" ===`);
    if (record) {
        console.log(JSON.stringify(record, null, 2));
    } else {
        console.log("NOT FOUND!");
    }
});
