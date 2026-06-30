const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '..', 'history');
const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

console.log("=== DNEX DAILY DATA RECORDED IN FILES ===");
files.forEach(file => {
  const dateStr = file.replace('data_', '').replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file)));
  const topVolume = data.topVolume || [];
  const dnex = topVolume.find(item => item.name === 'DNEX');
  if (dnex) {
    console.log(`Date: ${dateStr} | Price: RM ${dnex.price.toFixed(3)} | FloorLow: RM ${(dnex.floorLow || 0).toFixed(3)} | Touches: ${dnex.touchCount}x | Setup: ${dnex.setupName}`);
  }
});
