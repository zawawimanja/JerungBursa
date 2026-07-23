const fs = require('fs');

const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));

let output = '';

output += '=== Technology & Selected Target Stocks under RM 1.00 ===\n';
live.topVolume.forEach(item => {
    if (item.price < 1.00 && (item.sector.toLowerCase().includes('tech') || item.name === 'MMCS' || item.name === 'EIPOWER' || item.name === 'SRKK')) {
        output += `- ${item.name} (${item.sector}) | Price: RM ${item.price.toFixed(3)} | Signal: ${item.signal} | Pullback: ${item.pullback}% | TouchCount: ${item.touchCount} | CloseTightness: ${item.closeTightness}% | Setup: ${item.setupName}\n`;
    }
});

output += '\n=== All Buy Stocks under RM 1.00 (Excluding price 0/null) ===\n';
const cheapBuy = live.topVolume.filter(item => item.price > 0 && item.price < 1.00 && item.signal === 'buy');
cheapBuy.forEach(item => {
    output += `- ${item.name} (${item.sector}) | Price: RM ${item.price.toFixed(3)} | Pullback: ${item.pullback}% | TouchCount: ${item.touchCount} | CloseTightness: ${item.closeTightness}% | Setup: ${item.setupName} | Style: ${item.setupStyle}\n`;
    output += `  Reason: ${item.reason}\n`;
});

fs.writeFileSync("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\scratch\\similar_setups_output.txt", output, 'utf8');
console.log('Done writing setups');
