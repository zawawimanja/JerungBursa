const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\tracker_data.js", 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('SRKK')) {
        console.log(`Line ${idx+1}: ${line.trim()}`);
    }
});
