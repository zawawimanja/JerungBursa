const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\scrape-real.js", 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('i3investor') || line.includes('allRawStocks')) {
        console.log(`Line ${idx+1}: ${line.trim()}`);
    }
});
