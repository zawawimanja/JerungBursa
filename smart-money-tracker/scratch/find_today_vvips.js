const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'live_data.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const list = Array.isArray(data) ? data : (data.topVolume || []);

console.log("=== TODAY'S REVERSED PICKS ===");
list.forEach(item => {
    // Calculate smart score
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const floor = item.floorLow || (item.price * 0.97);
    const dist = ((item.price - floor) / floor) * 100;
    const stopLoss = floor * 0.97;
    
    // We only care about YEWLEE, LHI, SFPTECH, MMCS, SUM, CBHB
    if (['YEWLEE', 'LHI', 'SFPTECH', 'MMCS', 'SUM', 'CBHB'].includes(item.name)) {
        console.log(`- ${item.name}:`);
        console.log(`  Price: RM ${item.price.toFixed(3)}`);
        console.log(`  Floor Low: RM ${floor.toFixed(3)}`);
        console.log(`  Stop Loss (3% below floor): RM ${stopLoss.toFixed(3)}`);
        console.log(`  Turnover: RM ${(item.turnover / 1000000).toFixed(2)}M`);
        console.log(`  isVvip: ${item.isVvip}`);
        console.log(`  Change: ${pct.toFixed(2)}%`);
    }
});
