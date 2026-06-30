const fs = require('fs');
const path = require('path');

const axios = require('axios');
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

let symbolMappings = {};
try {
  symbolMappings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'symbol_mappings.json'), 'utf8'));
} catch (e) {}

async function testDailyTouches(lookbackDays) {
  console.log(`\n=== SIMULATING DAILY TOUCHES (${lookbackDays}-DAY LOOKBACK) ===`);
  const testList = ['HKB', 'OGX', 'SDCG', 'DNEX', 'BETA', 'LWSABAH'];
  
  for (const name of testList) {
    const symbol = symbolMappings[name] || name + '.KL';
    try {
      const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`, { headers: HEADERS });
      const chart = res.data.chart.result[0];
      const timestamp = chart.timestamp;
      const quote = chart.indicators.quote[0];
      const close = quote.close;
      const low = quote.low;
      
      const validDays = [];
      for (let i = 0; i < timestamp.length; i++) {
        if (close[i] !== null && low[i] !== null) {
          validDays.push({ close: close[i], low: low[i] });
        }
      }
      
      const dailyLookback = validDays.slice(-lookbackDays);
      const dailyLows = dailyLookback.map(d => d.low);
      const minLow = Math.min(...dailyLows);
      
      let touchCount = 0;
      dailyLookback.forEach(d => {
        const diffPct = ((d.low - minLow) / minLow) * 100;
        if (diffPct <= 2.0) {
          touchCount++;
        }
      });
      
      const currentPrice = dailyLookback[dailyLookback.length - 1].close;
      const dist = (((currentPrice - minLow) / minLow) * 100).toFixed(2);
      
      console.log(`📈 ${name.padEnd(8)} | Price: RM ${currentPrice.toFixed(3)} | Floor: RM ${minLow.toFixed(3)} | Dist: ${dist}% | Touches: ${touchCount}x`);
    } catch (e) {
      console.log(`❌ Error ${name}: ${e.message}`);
    }
  }
}

async function run() {
  await testDailyTouches(10);
  await testDailyTouches(15);
  await testDailyTouches(20);
}

run();
