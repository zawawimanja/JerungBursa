const fs = require('fs');
const path = require('path');
const axios = require('axios');

const mappingsPath = path.join(__dirname, '../symbol_mappings.json');
const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));

// List of Fresh IPOs / High Interest IPOs to analyze
const freshIpoList = [
    'SKYECHIP', 'STRATUS', 'EIPOWER', 'MMCS', 'KEEMING', 'PENTECH', 
    'SUM', 'ELSA', 'AMBEST', 'AMS', 'ISF', 'TEAMSTR', 'GDGROUP', 
    'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE', 'ADNEX', 
    'HKB', 'MNHLDG', 'TMK', 'ZETRIX', 'OPPSTAR', 'SDCG', 'CBHB', 
    'CNERGEN', 'MCLEAN', 'CPETECH', 'UUE', 'PWRWELL', 'CORAZA'
];

async function analyzeStock(name) {
    const symbol = mappings[name];
    if (!symbol) return null;
    
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`;
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 6000
        });
        
        const result = res.data.chart.result[0];
        const quote = result.indicators.quote[0];
        const closes = quote.close ? quote.close.filter(c => c !== null) : [];
        const lows = quote.low ? quote.low.filter(l => l !== null) : [];
        const highs = quote.high ? quote.high.filter(h => h !== null) : [];
        
        if (closes.length < 10) return null;
        
        const currentPrice = result.meta.regularMarketPrice || closes[closes.length - 1];
        
        // Take recent 20-30 trading days to find the RECENT CONSOLIDATION FLOOR (ignoring day 1 extreme wick)
        const recentLows = lows.slice(-25);
        const recentCloses = closes.slice(-25);
        
        // Calculate recent floor by taking the 15th percentile / mode region of recent lows
        const sortedRecentLows = [...recentLows].sort((a, b) => a - b);
        // Take the lower-bound cluster (ignoring 1-2 extreme single-day outliers)
        const recentFloor = sortedRecentLows[Math.min(2, sortedRecentLows.length - 1)];
        
        // Count how many recent days touched this floor (within 1.8% tolerance)
        const touchCount = recentLows.filter(l => Math.abs((l - recentFloor) / recentFloor) <= 0.018).length;
        
        // Distance to recent floor
        const floorDist = ((currentPrice - recentFloor) / recentFloor) * 100;
        
        // 10-day Close Tightness
        const last10Closes = closes.slice(-10);
        const max10 = Math.max(...last10Closes);
        const min10 = Math.min(...last10Closes);
        const closeTightness = ((max10 - min10) / min10) * 100;
        
        // Max high in recent 3 months
        const periodHigh = Math.max(...highs);
        const pullback = ((periodHigh - currentPrice) / periodHigh) * 100;
        
        return {
            name,
            symbol,
            currentPrice,
            recentFloor,
            touchCount,
            floorDist,
            closeTightness,
            pullback,
            periodHigh
        };
    } catch (err) {
        return null;
    }
}

async function runScan() {
    console.log('🔍 ANALYZING ALL FRESH IPOS FOR CONSOLIDATION FLOORS (SKYECHIP & STRATUS DNA)...');
    console.log('='.repeat(70));
    
    const results = [];
    for (const name of freshIpoList) {
        const data = await analyzeStock(name);
        if (data) {
            results.push(data);
        }
    }
    
    // Sort by tightness & floor distance (best accumulation setups first)
    // Filter: floorDist <= 5.0%, touchCount >= 3, closeTightness <= 6.0%
    const accumulationSetups = results.filter(r => r.floorDist <= 5.0 && r.touchCount >= 3 && r.closeTightness <= 6.0);
    
    accumulationSetups.sort((a, b) => a.floorDist - b.floorDist);
    
    console.log(`\n✅ FOUND ${accumulationSetups.length} FRESH IPOS IN ACTIVE SOLID BASE ACCUMULATION:\n`);
    
    accumulationSetups.forEach((s, idx) => {
        console.log(`${idx + 1}. 🎯 ${s.name} (${s.symbol})`);
        console.log(`   - Current Price: RM ${s.currentPrice.toFixed(3)} | Recent Base Floor: RM ${s.recentFloor.toFixed(3)}`);
        console.log(`   - Floor Distance: +${s.floorDist.toFixed(2)}% | Floor Touches (25d): ${s.touchCount}x`);
        console.log(`   - Close Tightness (10d): ${s.closeTightness.toFixed(2)}% | Pullback from Peak: ${s.pullback.toFixed(2)}%`);
        console.log('---');
    });
    
    console.log('\n📊 OTHER FRESH IPOS NEAR BASE (FLOOR DIST <= 8%):');
    const nearSetups = results.filter(r => r.floorDist > 5.0 && r.floorDist <= 8.5);
    nearSetups.forEach((s, idx) => {
        console.log(`- ${s.name} (${s.symbol}) | Price: RM ${s.currentPrice.toFixed(3)} | Floor: RM ${s.recentFloor.toFixed(3)} | Dist: +${s.floorDist.toFixed(2)}% | Touches: ${s.touchCount}x | Tightness: ${s.closeTightness.toFixed(2)}%`);
    });
}

runScan();
