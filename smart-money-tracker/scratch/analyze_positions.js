const fs = require('fs');
const path = require('path');

// Load live data
const liveDataPath = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

// Load IPO Database from scrape-real.js or similar
// We can reconstruct the mappings from our code:
const ipoMap = {
    "YEWLEE": "B",
    "SFPTECH": "A"
};
const ipoPriceMap = {
    "YEWLEE": 0.280,
    "SFPTECH": 0.300
};
const ipoYearMap = {
    "YEWLEE": 2022,
    "SFPTECH": 2022
};

const targets = ["YEWLEE", "SFPTECH"];

console.log("=== ANALYSIS OF USER POSITIONS (TREND RIDER METHOD) ===");

targets.forEach(t => {
    const item = data.find(c => c.name.toUpperCase().includes(t));
    if (!item) {
        console.log(`\n❌ Stock ${t} not found in live data.`);
        return;
    }

    const price = item.price;
    const ipoPrice = ipoPriceMap[t] || item.ipoPrice || 0;
    const ipoYear = ipoYearMap[t] || item.ipoYear || 0;
    const grade = ipoMap[t] || item.ipoGrade || "N/A";
    
    // Check if it is Fresh IPO
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    const isDowntrend = item.isSmaDowntrend || (item.setupName || '').toUpperCase().includes('DOWNTREND');
    const isFresh = ipoYear >= 2020 && !isDowntrend;
    
    const floor = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floor) / floor) * 100;
    const stopLoss = floor * 0.97;
    const riskPct = ((price - stopLoss) / price) * 100;
    
    const pullback = item.pullback !== null ? item.pullback : 0;
    
    console.log(`\n📌 Counter: ${item.name} (${t})`);
    console.log(`   - Current Price: RM ${price.toFixed(3)}`);
    console.log(`   - IPO Offer Price: RM ${ipoPrice.toFixed(3)} (Listed: ${ipoYear})`);
    console.log(`   - IPO Grade: ${grade} (${grade === 'A' || grade === 'B' ? '💎 Premium IPO' : 'Regular'})`);
    console.log(`   - Performance vs IPO: ${((price - ipoPrice) / ipoPrice * 100).toFixed(1)}%`);
    console.log(`   - Pullback from 52W High: -${pullback.toFixed(1)}%`);
    console.log(`   - Support Floor: RM ${floor.toFixed(3)} (Distance: +${distToFloor.toFixed(1)}%)`);
    console.log(`   - SOP Stop Loss (-3% below floor): RM ${stopLoss.toFixed(3)} (Max Risk: -${riskPct.toFixed(1)}%)`);
    console.log(`   - Status: ${isFresh ? '🟢 FRESH IPO' : '🧱 MATURE IPO / DOWNTREND (Exceeded early support)'}`);
});
