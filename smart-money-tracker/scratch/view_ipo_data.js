const fs = require('fs');
const path = require('path');

const ipoPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
if (fs.existsSync(ipoPath)) {
    const data = JSON.parse(fs.readFileSync(ipoPath, 'utf8'));
    console.log("=== FIRST 5 IPO DATA RECORDS ===");
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
} else {
    console.log("Not found!");
}
