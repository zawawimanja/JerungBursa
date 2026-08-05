const fs = require('fs');
const path = require('path');
const axios = require('axios');

const liveDataPath = path.join(__dirname, '../live_data.json');
const mappingsPath = path.join(__dirname, '../symbol_mappings.json');

const liveData = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));

console.log('=== SCANNING ALL FRESH IPOS FOR STRATUS-LIKE ACCUMULATION ===\n');

const allStocks = liveData.topVolume || [];

// Filter stocks that show accumulation characteristics
const accumulationCandidates = allStocks.filter(stock => {
    if (!stock.price || stock.price <= 0) return false;
    
    // Check if price > SMA50 (uptrend priority rule #1)
    const isUptrend = !stock.sma50 || stock.price >= stock.sma50;
    
    // Floor distance check (tight risk <= 5%)
    const distToFloor = stock.floorLow ? (((stock.price - stock.floorLow) / stock.floorLow) * 100) : 999;
    const isTightFloor = distToFloor <= 5.0;
    
    // Touch count & consolidation tightness
    const isSolidBase = (stock.touchCount >= 3) || stock.isConsolidation;
    const isTightClose = !stock.closeTightness || stock.closeTightness <= 6.0;
    const isNotDeepCrash = stock.pullback === undefined || stock.pullback <= 20.0;
    const notComb = !stock.isCombStock;

    return isUptrend && isTightFloor && isSolidBase && isTightClose && isNotDeepCrash && notComb;
});

console.log(`Found ${accumulationCandidates.length} accumulation candidates in current dataset:\n`);

accumulationCandidates.sort((a, b) => (b.touchCount || 0) - (a.touchCount || 0));

accumulationCandidates.forEach((s, idx) => {
    const distToFloor = s.floorLow ? (((s.price - s.floorLow) / s.floorLow) * 100).toFixed(2) : 'N/A';
    console.log(`${idx + 1}. ${s.name} (${s.sector || 'N/A'})`);
    console.log(`   - Price: RM ${s.price.toFixed(3)} | Signal: ${s.signal.toUpperCase()}`);
    console.log(`   - Touches: ${s.touchCount}x | Floor Dist: ${distToFloor}% | Close Tightness: ${s.closeTightness}%`);
    console.log(`   - Pullback: ${s.pullback}% | Setup: ${s.setupName} | Style: ${s.setupStyle}`);
    console.log(`   - Reason: ${s.reason}`);
    console.log('---');
});
