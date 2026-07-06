const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

const ams = data.find(r => r.id.toLowerCase().includes('ams') || (r.symbol && r.symbol.toUpperCase() === 'AMS'));
console.log("=== AMS DATA IN data.json ===");
if (ams) {
    console.log(JSON.stringify(ams, null, 2));
} else {
    console.log("AMS NOT FOUND IN data.json!");
}
