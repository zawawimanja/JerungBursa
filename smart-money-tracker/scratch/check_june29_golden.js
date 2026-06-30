const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'live_data.json');
if (!fs.existsSync(filePath)) {
  console.log("File not found");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

console.log("=== 👑 GOLDEN ZONE SETUP EMAS ON 2026-06-29 ===");
const goldenSignals = data.filter(item => {
  const floor = item.floorLow || (item.price * 0.97);
  const dist = parseFloat((((item.price - floor) / floor) * 100).toFixed(2));
  const isDowntrend = item.setupName && (
    item.setupName.includes('Downtrend') || 
    item.setupName.includes('Avoid') || 
    item.setupName === 'N/A'
  );
  
  return item.isConsolidation && 
         item.signal === 'buy' && 
         !isDowntrend && 
         item.price <= 3.00 && 
         item.touchCount >= 3 && 
         dist <= 3.0 && 
         item.hasLowerWickRejection;
});

goldenSignals.forEach((item, index) => {
  const floor = item.floorLow || (item.price * 0.97);
  const dist = (((item.price - floor) / floor) * 100).toFixed(2);
  console.log(`${index + 1}. Name=${item.name} | Price=RM ${item.price.toFixed(3)} | Touches=${item.touchCount}x | DistToFloor=${dist}% | Setup=${item.setupName}`);
});

console.log(`\nTotal Golden Zone signals: ${goldenSignals.length}`);
