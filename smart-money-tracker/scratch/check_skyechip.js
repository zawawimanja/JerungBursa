const fs = require('fs');
const path = require('path');
const axios = require('axios');

const liveDataPath = path.join(__dirname, '../live_data.json');
const liveData = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));

console.log('=== CHECKING SKYECHIP STATUS IN LIVE DATA & YAHOO FINANCE ===\n');

// 1. Search in live_data.json
const foundInLive = liveData.topVolume.find(s => s.name.toUpperCase().includes('SKYE') || s.name.toUpperCase().includes('5357'));

if (foundInLive) {
    console.log('Found SKYECHIP in live_data.json:');
    console.log(JSON.stringify(foundInLive, null, 2));
} else {
    console.log('❌ SKYECHIP was NOT found in live_data.json snapshot.');
}

// 2. Fetch live data for SKYECHIP (5357.KL) directly from Yahoo Finance
async function fetchYahooSkyechip() {
    try {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/5357.KL?range=3mo&interval=1d';
        console.log(`\n🌐 Fetching live chart for 5357.KL (SKYECHIP) from Yahoo Finance...`);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        const result = res.data.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators.quote[0];
        const closes = quote.close.filter(c => c !== null);
        const highs = quote.high.filter(h => h !== null);
        const lows = quote.low.filter(l => l !== null);
        
        const currentPrice = meta.regularMarketPrice;
        const prevClose = meta.previousClose || meta.chartPreviousClose;
        const change = currentPrice - prevClose;
        const changePct = (change / prevClose) * 100;
        
        const maxHigh = Math.max(...highs);
        const minLow = Math.min(...lows);
        const pullback = ((maxHigh - currentPrice) / maxHigh) * 100;
        const floorDist = ((currentPrice - minLow) / minLow) * 100;

        console.log(`✅ SKYECHIP (5357.KL) Live Market Data:`);
        console.log(`   - Current Price: RM ${currentPrice.toFixed(3)}`);
        console.log(`   - Change: ${change >= 0 ? '+' : ''}${change.toFixed(3)} (${changePct.toFixed(2)}%)`);
        console.log(`   - 52w/Period High: RM ${maxHigh.toFixed(3)} | Period Low (Floor): RM ${minLow.toFixed(3)}`);
        console.log(`   - Pullback from Peak: ${pullback.toFixed(2)}%`);
        console.log(`   - Distance to Floor Low: +${floorDist.toFixed(2)}%`);
        console.log(`   - Total Trading Days in Chart: ${closes.length}`);
    } catch (err) {
        console.error('❌ Failed to fetch SKYECHIP from Yahoo Finance:', err.message);
    }
}

fetchYahooSkyechip();
