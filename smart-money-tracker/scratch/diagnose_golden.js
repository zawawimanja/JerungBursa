const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'live_data.json');
if (!fs.existsSync(filePath)) {
  console.log("File not found");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

console.log("=== DIAGNOSING GOLDEN ZONE CANDIDATES ===");
data.forEach(item => {
  const floor = item.floorLow || (item.price * 0.97);
  const dist = parseFloat((((item.price - floor) / floor) * 100).toFixed(2));
  const isDowntrend = item.setupName && (
    item.setupName.includes('Downtrend') || 
    item.setupName.includes('Avoid') || 
    item.setupName === 'N/A'
  );
  
  // We look at counters that are isConsolidation and price <= 3.00
  if (item.isConsolidation && item.price <= 3.00) {
    const reasons = [];
    if (item.signal !== 'buy') reasons.push(`signal is ${item.signal} (expected 'buy')`);
    if (isDowntrend) reasons.push(`is downtrend (${item.setupName})`);
    if (item.touchCount < 3) reasons.push(`touchCount is ${item.touchCount} (expected >= 3)`);
    if (dist > 1.5) reasons.push(`dist to floor is ${dist}% (expected <= 1.5%)`);
    if (!item.hasLowerWickRejection) reasons.push(`no lower wick rejection`);
    
    console.log(`- Ticker: ${item.name.padEnd(8)} | Price: RM ${item.price.toFixed(3)} | Floor: RM ${floor.toFixed(3)} | Touches: ${item.touchCount}x | Dist: ${dist}% | Result: ${reasons.length === 0 ? '🏆 PASSED' : '❌ FAILED because ' + reasons.join(', ')}`);
  }
});
