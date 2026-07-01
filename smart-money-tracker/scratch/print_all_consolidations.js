const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_data.json'), 'utf8'));
const list = data.topVolume || [];

console.log("=== ALL CONSOLIDATION STOCKS ===");
list.forEach(item => {
    if (item.isConsolidation) {
        const floor = item.floorLow || (item.price * 0.97);
        const dist = parseFloat((((item.price - floor) / floor) * 100).toFixed(2));
        console.log(`- ${item.name.padEnd(20)} | Price: ${item.price.toFixed(3)} | Floor: ${floor.toFixed(3)} | Dist: ${dist.toFixed(2)}% | Touches: ${item.touchCount}x | Signal: ${item.signal} | Setup: ${item.setupName} | CombStock: ${item.isCombStock} | Wick: ${item.hasLowerWickRejection}`);
    }
});
