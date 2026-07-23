const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\index.html", 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('Tbody') || line.includes('tbody') || line.includes('Section') || line.includes('section')) {
        if (line.includes('spring') || line.includes('fishing') || line.includes('Picks') || line.includes('picks') || line.includes('recommend')) {
            console.log(`Line ${idx+1}: ${line.trim()}`);
        }
    }
});
