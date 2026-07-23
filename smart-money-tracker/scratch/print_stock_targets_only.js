const fs = require('fs');

const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));

const targets = ['EIPOWER', 'MMCS', 'SRKK', 'STRATUS', 'RTECH'];

console.log('=== Target Stocks ===');
targets.forEach(target => {
    const found = live.topVolume.find(item => item.name.toUpperCase() === target.toUpperCase());
    if (found) {
        console.log(`\nTicker: ${target}`);
        console.log(`- Price: RM ${found.price}`);
        console.log(`- Signal: ${found.signal}`);
        console.log(`- Pullback: ${found.pullback}%`);
        console.log(`- Setup: ${found.setupName}`);
        console.log(`- TouchCount: ${found.touchCount}`);
        console.log(`- CloseTightness: ${found.closeTightness}%`);
        console.log(`- Reason: ${found.reason}`);
    } else {
        console.log(`\nNot found in live_data.json: ${target}`);
    }
});

console.log('\n=== Stocks under RM 1.00 with "buy" signal in topVolume ===');
const cheapBuyStocks = live.topVolume.filter(item => item.price < 1.00 && item.signal === 'buy');
cheapBuyStocks.forEach(item => {
    console.log(`- ${item.name} (${item.sector}) | Price: RM ${item.price.toFixed(3)} | Pullback: ${item.pullback}% | TouchCount: ${item.touchCount} | CloseTightness: ${item.closeTightness}% | Setup: ${item.setupName}`);
    console.log(`  Reason: ${item.reason}`);
});
