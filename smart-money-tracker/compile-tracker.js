const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, 'history');
const OUTPUT_FILE = path.join(__dirname, 'tracker_data.js');

function calculateSmartScore(item) {
  let score = 0;
  const price = item.price;
  const floorLow = item.floorLow || (price * 0.95);
  const distToFloor = ((price - floorLow) / floorLow) * 100;
  const pullbackVal = item.pullback !== null && item.pullback !== undefined ? item.pullback : 0;
  
  if (distToFloor <= 1.5) score += 4;
  else if (distToFloor <= 3.0) score += 2;
  else if (distToFloor <= 7.0) score += 1;
  
  if (item.touchCount >= 5) score += 3;
  else if (item.touchCount >= 3) score += 2;
  else if (item.touchCount >= 2) score += 1;
  
  if (item.isConsolidation) score += 2;
  
  if (pullbackVal <= 5.0) score += 3;
  else if (pullbackVal <= 12.0) score += 2;
  else if (pullbackVal <= 25.0) score += 1;
  
  const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
  const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
  if (isAboveSma50) score += 2;
  if (isAboveSma200) score += 1;
  
  if (item.turnover >= 5000000) score += 1;
  
  if (item.ipoGrade === 'A') score += 3;
  else if (item.ipoGrade === 'B') score += 2;
  else if (item.ipoGrade === 'C') score += 1;
  
  if (pullbackVal <= 3.0 && isAboveSma50 && isAboveSma200) {
    score += 2;
  }
  
  return score;
}

if (!fs.existsSync(HISTORY_DIR)) {
  console.error("History folder not found.");
  process.exit(1);
}

// 1. Get all chronological data files
const files = fs.readdirSync(HISTORY_DIR)
  .filter(f => f.startsWith('data_') && f.endsWith('.json'))
  .sort();

console.log(`Analyzing ${files.length} historical files...`);

const timeline = files.map(f => {
  const date = f.replace('data_', '').replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8'));
  return {
    date,
    stocks: data.topVolume || []
  };
});

// 2. Identify BUY triggers below RM 1
const triggers = [];
const seenTriggers = new Set(); // key: "STOCK_DATE"

for (let di = 0; di < timeline.length; di++) {
  const day = timeline[di];
  const stocks = day.stocks;
  
  for (const s of stocks) {
    const nameUpper = s.name.toUpperCase();
    const setup = (s.setupStyle || s.style || '').toUpperCase();
    const score = calculateSmartScore(s);
    
    const isBuySetup = s.signal === 'buy' && (setup === 'STAIRCASE' || setup === 'TREND RIDER' || score >= 10);
    
    if (s.price > 0 && s.price < 1.0 && isBuySetup) {
      // Avoid duplicate triggers in a 5-day window
      let recentlyTriggered = false;
      for (let prevOffset = 1; prevOffset <= 5; prevOffset++) {
        if (di - prevOffset >= 0) {
          const prevDate = timeline[di - prevOffset].date;
          if (seenTriggers.has(`${nameUpper}_${prevDate}`)) {
            recentlyTriggered = true;
            break;
          }
        }
      }
      
      if (!recentlyTriggered) {
        seenTriggers.add(`${nameUpper}_${day.date}`);
        triggers.push({
          name: s.name,
          date: day.date,
          triggerPrice: s.price,
          triggerDayIndex: di,
          setup: s.setupStyle || s.style || 'STAIRCASE',
          score: score,
          turnover: s.turnover || 0
        });
      }
    }
  }
}

// Map latest day for lookup
const latestDay = timeline[timeline.length - 1];
const latestStockMap = new Map(latestDay.stocks.map(s => [s.name.toUpperCase(), s]));

// 3. Track performance for 10 days post-trigger
const output = triggers.map(tr => {
  const diffs = [];
  
  for (let k = 1; k <= 10; k++) {
    const targetIdx = tr.triggerDayIndex + k;
    if (targetIdx >= timeline.length) {
      diffs.push(null); // Beyond timeline length (future)
    } else {
      const targetDay = timeline[targetIdx];
      const targetStock = targetDay.stocks.find(s => s.name.toUpperCase() === tr.name.toUpperCase());
      if (targetStock && targetStock.price > 0) {
        const diff = ((targetStock.price - tr.triggerPrice) / tr.triggerPrice) * 100;
        diffs.push(parseFloat(diff.toFixed(1)));
      } else {
        diffs.push("N/A"); // Stock not in that day's top volume
      }
    }
  }
  
  // Find current price in the latest day
  const latestStock = latestStockMap.get(tr.name.toUpperCase());
  let currentPrice = null;
  let currentDiff = null;
  
  if (latestStock && latestStock.price > 0) {
    currentPrice = latestStock.price;
    currentDiff = parseFloat((((currentPrice - tr.triggerPrice) / tr.triggerPrice) * 100).toFixed(1));
  } else {
    // Look back from latest to find last known price
    for (let i = timeline.length - 1; i >= 0; i--) {
      const s = timeline[i].stocks.find(x => x.name.toUpperCase() === tr.name.toUpperCase());
      if (s && s.price > 0) {
        currentPrice = s.price;
        currentDiff = parseFloat((((currentPrice - tr.triggerPrice) / tr.triggerPrice) * 100).toFixed(1));
        break;
      }
    }
  }
  
  // Gold Criteria: Score >= 11, STAIRCASE or EXPLOSIVE setup, and Turnover >= RM 750,000
  const isGold = tr.score >= 11 && 
                 (tr.setup === 'STAIRCASE' || tr.setup === 'EXPLOSIVE') && 
                 tr.turnover >= 750000;
  
  return {
    name: tr.name,
    date: tr.date,
    triggerPrice: tr.triggerPrice,
    setup: tr.setup,
    score: tr.score,
    turnover: tr.turnover,
    isGold,
    currentPrice,
    currentDiff,
    diffs
  };
});

// Sort triggers chronologically (newest trigger first)
output.reverse();

const jsContent = `window.TRACKER_DATA = ${JSON.stringify(output, null, 2)};`;
fs.writeFileSync(OUTPUT_FILE, jsContent);
console.log(`✅ Success! Tracker data saved to ${OUTPUT_FILE} (${output.length} records).`);
