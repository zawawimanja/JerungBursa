const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\scrape-real.js", 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('isCombStock') || line.includes('comb') || line.includes('sikat')) {
        console.log(`Line ${idx+1}: ${line.trim()}`);
    }
});
