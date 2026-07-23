const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\index.html", 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('fetch') || line.includes('liveData') || line.includes('load') || line.includes('DOMContentLoaded')) {
        if (line.includes('render') || line.includes('init') || line.includes('data')) {
            console.log(`Line ${idx+1}: ${line.trim()}`);
        }
    }
});
