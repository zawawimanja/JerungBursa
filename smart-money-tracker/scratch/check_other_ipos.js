const fs = require('fs');
const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));

const names = ['PENTECH', 'SUM', '3REN', 'ELSA', 'LIFTECH', 'ECKEM', 'RTECH', 'RESTNGO'];
console.log('=== Checking other recent IPOs ===');
names.forEach(name => {
    const found = live.topVolume.find(item => item.name.toUpperCase() === name.toUpperCase());
    if (found) {
        console.log(`- ${found.name} (${found.sector}) | Price: RM ${found.price.toFixed(3)} | Signal: ${found.signal} | Pullback: ${found.pullback}% | TouchCount: ${found.touchCount} | CloseTightness: ${found.closeTightness}% | Setup: ${found.setupName}`);
    } else {
        console.log(`- ${name} not found in topVolume`);
    }
});
