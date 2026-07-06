const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

const record = data.find(r => r.id === 'mtt-shipping');
console.log("=== mtt-shipping RECORD ===");
console.log(JSON.stringify(record, null, 2));
