const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const lines = fs.readFileSync(ipoDataPath, 'utf8').split('\n');

const searchIds = ['adnex', 'alpha-ivf', 'lpbhd', 'northeast', 'saliran'];

searchIds.forEach(id => {
    console.log(`\n=== SEARCH FOR ID: "${id}" ===`);
    let found = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`"id": "${id}"`) || lines[i].includes(`"id": "${id}`) || lines[i].toLowerCase().includes(`"${id}"`)) {
            found = true;
            console.log(`Line ${i+1}: ${lines[i].trim()}`);
            // Print context lines around it
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length - 1, i + 12);
            for (let j = start; j <= end; j++) {
                console.log(`  [${j+1}] ${lines[j]}`);
            }
            break;
        }
    }
    if (!found) console.log("Not found!");
});
