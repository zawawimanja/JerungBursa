const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

const record = data.find(r => r.id.toLowerCase().includes('3ren') || (r.symbol && r.symbol.toUpperCase().includes('3REN')));
console.log("=== 3REN RECORD IN data.json ===");
if (record) {
    console.log(JSON.stringify(record, null, 2));
} else {
    console.log("3REN NOT FOUND!");
}
