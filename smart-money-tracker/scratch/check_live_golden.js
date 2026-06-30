const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/home/awi/Desktop/BSKL/smart-money-tracker/live_data.json', 'utf8'));
const list = data.topVolume || data.processedData || [];

console.log("=== FINAL GOLDEN ZONE FILTERS ===");
list.forEach(item => {
    const floor = item.floorLow || (item.price * 0.97);
    const dist = parseFloat((((item.price - floor) / floor) * 100).toFixed(2));
    
    const isDowntrend = item.setupName && (
        item.setupName.includes('Downtrend') || 
        item.setupName.includes('Avoid') || 
        item.setupName === 'N/A'
    );
    
    const isNearAthOr52w = item.pullback !== undefined && item.pullback !== null && item.pullback <= 15.0;
    
    const matchesBase = item.isConsolidation && 
           item.signal === 'buy' && 
           !isDowntrend && 
           item.price <= 3.00 && 
           item.touchCount >= 3 && 
           dist <= 3.0 &&
           isNearAthOr52w;
           
    if (matchesBase) {
        console.log(`- ${item.name} | Price: ${item.price.toFixed(3)} | Setup: ${item.setupName} | Pullback: ${item.pullback}% | Floor: ${floor.toFixed(3)} | Dist: ${dist}% | Rejection: ${item.hasLowerWickRejection}`);
    }
});
