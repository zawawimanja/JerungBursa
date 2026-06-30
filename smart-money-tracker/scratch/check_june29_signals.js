const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'live_data.json');
if (!fs.existsSync(filePath)) {
  console.log("File not found");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

console.log("=== SIGNALS CAPTURED ON 2026-06-29 (SEMALAM) ===");
const buySignals = data.filter(item => item.signal === 'buy');

buySignals.forEach((item, index) => {
  const floor = item.floorLow || (item.price * 0.97);
  const dist = (((item.price - floor) / floor) * 100).toFixed(2);
  const isDowntrend = item.setupName && (
    item.setupName.includes('Downtrend') || 
    item.setupName.includes('Avoid') || 
    item.setupName === 'N/A'
  );
  
  console.log(`${index + 1}. Name=${item.name.padEnd(8)} | Price=RM ${item.price.toFixed(3)} | Change=${(item.changePct !== undefined ? item.changePct : item.change).toFixed(2)}% | Floor=RM ${floor.toFixed(3)} | Touches=${item.touchCount || 0}x | DistToFloor=${dist}% | Setup=${item.setupName || 'None'} | Consolidate=${item.isConsolidation ? 'Yes' : 'No'} | RejectEkor=${item.hasLowerWickRejection ? 'Yes' : 'No'}`);
});

console.log(`\nTotal buy signals: ${buySignals.length}`);
