const fs = require('fs');
const path = require('path');

const dates = [
  '2026-06-08',
  '2026-06-09',
  '2026-06-10',
  '2026-06-11',
  '2026-06-12',
  '2026-06-15'
];

console.log("=== HISTORICAL TRACKING FOR HKB (0359.KL) ===");
dates.forEach(date => {
  const filePath = path.join(__dirname, '..', 'history', `data_${date}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`${date}: File not found`);
    return;
  }
  
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const data = Array.isArray(raw) ? raw : (raw.topVolume || []);
    const hkb = data.find(item => item.name === 'HKB' || item.symbol === '0359.KL' || item.name.includes('0359'));
    
    if (hkb) {
      const floor = hkb.floorLow || (hkb.price * 0.97);
      const dist = (((hkb.price - floor) / floor) * 100).toFixed(2);
      console.log(`${date}: Price=RM ${hkb.price.toFixed(3)}, Change=${hkb.changePct || hkb.change}%, Floor=RM ${floor.toFixed(3)}, Touch=${hkb.touchCount || 0}x, DistToFloor=${dist}%, Signal=${hkb.signal}, Setup=${hkb.setupName || 'None'}`);
    } else {
      console.log(`${date}: HKB not scanned / not found in history`);
    }
  } catch (e) {
    console.log(`${date}: Error parsing file - ${e.message}`);
  }
});
