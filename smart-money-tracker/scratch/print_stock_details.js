const fs = require('fs');

const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));

const targets = ['EIPOWER', 'MMCS', 'SRKK', 'STRATUS', 'RTECH'];

console.log('=== Targets in live_data.json (topVolume) ===');
targets.forEach(target => {
    const found = live.topVolume.find(item => item.name.toUpperCase() === target.toUpperCase());
    if (found) {
        console.log(`\nFound: ${target}`);
        console.log(JSON.stringify(found, null, 2));
    } else {
        console.log(`\nNot found: ${target}`);
    }
});

// Let's also look for all stocks in topVolume that have a price under RM 1.00 and are marked as 'buy' or are in a hot setup,
// especially tech stocks or those with similar setups to MMCS/Stratus.
console.log('\n=== Stocks under RM 1.00 with "buy" signal in topVolume ===');
const cheapBuyStocks = live.topVolume.filter(item => item.price < 1.00 && item.signal === 'buy');
console.log(`Found ${cheapBuyStocks.length} cheap buy stocks:`);
cheapBuyStocks.forEach(item => {
    console.log(`- ${item.name} (${item.sector}) | Price: RM ${item.price.toFixed(3)} | Pullback: ${item.pullback}% | TouchCount: ${item.touchCount} | CloseTightness: ${item.closeTightness}% | Setup: ${item.setupName} | Reason: ${item.reason}`);
});

console.log('\n=== Stocks under RM 1.00 with "avoid" signal in topVolume ===');
const cheapAvoidStocks = live.topVolume.filter(item => item.price < 1.00 && item.signal === 'avoid');
console.log(`Found ${cheapAvoidStocks.length} cheap avoid stocks:`);
cheapAvoidStocks.forEach(item => {
    console.log(`- ${item.name} (${item.sector}) | Price: RM ${item.price.toFixed(3)} | Setup: ${item.setupName}`);
});
