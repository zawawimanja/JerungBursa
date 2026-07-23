const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\index.html", 'utf8');
const lines = content.split('\n');
let openDivs = 0;
let startTrack = false;
lines.forEach((line, idx) => {
    if (line.includes('id="view-tracker"')) {
        startTrack = true;
    }
    if (startTrack) {
        // Count open and close divs
        const openMatches = line.match(/<div/g);
        const closeMatches = line.match(/<\/div>/g);
        if (openMatches) openDivs += openMatches.length;
        if (closeMatches) openDivs -= closeMatches.length;
        if (openDivs === 0) {
            console.log(`view-tracker ends around line ${idx+1}: ${line.trim()}`);
            startTrack = false;
        }
    }
});
