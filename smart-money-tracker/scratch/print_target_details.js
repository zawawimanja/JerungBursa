const fs = require('fs');

const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));

const targets = ['EIPOWER', 'MMCS', 'SRKK', 'STRATUS', 'RTECH'];
let output = '=== Target Stocks ===\n';

targets.forEach(target => {
    const found = live.topVolume.find(item => item.name.toUpperCase() === target.toUpperCase());
    if (found) {
        output += `\nTicker: ${target}\n`;
        output += `- Price: RM ${found.price}\n`;
        output += `- Signal: ${found.signal}\n`;
        output += `- Pullback: ${found.pullback}%\n`;
        output += `- Setup: ${found.setupName}\n`;
        output += `- TouchCount: ${found.touchCount}\n`;
        output += `- CloseTightness: ${found.closeTightness}%\n`;
        output += `- Reason: ${found.reason}\n`;
    } else {
        output += `\nNot found: ${target}\n`;
    }
});

// Write to file
fs.writeFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\scratch\\target_details.txt", output, 'utf8');
console.log('Done writing target details');
