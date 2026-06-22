const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MAPPING_FILE = path.join(__dirname, 'symbol_mappings.json');

const watchlist = [
    'SKYECHIP', 'OPPSTAR', 'EIPOWER', 'PENTECH', 'KEEMING', 'SUM', 
    'ADNEX', 'HKB', 'AMBEST', 'SUNMED', 'MMCS', 'DNEX', 'AMS', 
    'SDCG', 'NE', 'ISF', 'OGX', 'MNHLDG', 'LWSABAH', 'CBHB', 
    'IAB', 'CNERGEN', 'ELSA', 'SAM', 'TMK'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let symbolMappings = {};
if (fs.existsSync(MAPPING_FILE)) {
    symbolMappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
}

async function analyzeConsolidation(name, symbol) {
    try {
        await sleep(150);
        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const result = response.data.chart.result[0];
        if (!result || !result.timestamp) return null;
        
        const timestamp = result.timestamp;
        const quote = result.indicators.quote[0];
        const close = quote.close;
        const low = quote.low;
        const high = quote.high;
        
        const validDays = [];
        for (let i = 0; i < timestamp.length; i++) {
            if (close[i] !== null && close[i] !== undefined && low[i] !== null && low[i] !== undefined) {
                validDays.push({
                    date: new Date(timestamp[i] * 1000).toISOString().split('T')[0],
                    open: quote.open[i],
                    high: high[i],
                    low: low[i],
                    close: close[i],
                    volume: quote.volume[i]
                });
            }
        }
        
        if (validDays.length < 5) return null;
        
        // Calculate 52W High
        let high52 = 0;
        validDays.forEach(d => {
            if (d.high > high52) high52 = d.high;
        });
        
        const lastDays = validDays.slice(-4); // Last 4 trading days
        const currentPrice = lastDays[lastDays.length - 1].close;
        const pullback = ((high52 - currentPrice) / high52) * 100;
        
        const closes = lastDays.map(d => d.close);
        const maxClose = Math.max(...closes);
        const minClose = Math.min(...closes);
        const closeTightness = ((maxClose - minClose) / minClose) * 100;
        
        const lows = lastDays.map(d => d.low);
        const minLow = Math.min(...lows);
        
        let touchCount = 0;
        lastDays.forEach(d => {
            const diffPct = ((d.low - minLow) / minLow) * 100;
            if (diffPct <= 2.0) { // within 2% of the minimum low
                touchCount++;
            }
        });
        
        const maxLow = Math.max(...lows);
        const lowTightness = ((maxLow - minLow) / minLow) * 100;
        
        return {
            name,
            symbol,
            price: currentPrice,
            pullback,
            high52,
            closeTightness,
            lowTightness,
            minLow,
            touchCount,
            lastLows: lastDays.map(d => d.low.toFixed(3)).join(', '),
            lastCloses: lastDays.map(d => d.close.toFixed(3)).join(', ')
        };
        
    } catch (e) {
        return null;
    }
}

async function run() {
    console.log("=====================================================================");
    console.log("📊 METRIKS KONSOLIDASI & MULTI-TOUCH UNTUK SEMUA KAUNTER");
    console.log("=====================================================================");
    
    const results = [];
    
    for (const name of watchlist) {
        const symbol = symbolMappings[name.toUpperCase()];
        if (!symbol) continue;
        
        const analysis = await analyzeConsolidation(name, symbol);
        if (!analysis) continue;
        
        results.push(analysis);
    }
    
    results.sort((a, b) => a.pullback - b.pullback);
    
    console.log("KAUNTER".padEnd(12) + "PULLBACK".padEnd(10) + "JULAT CLOSE".padEnd(12) + "JULAT LOW".padEnd(10) + "TOUCHES".padEnd(8) + "LOWS IN LAST 4 DAYS");
    console.log("-".repeat(90));
    
    results.forEach(c => {
        console.log(
            c.name.padEnd(12) +
            `${c.pullback.toFixed(1)}%`.padEnd(10) +
            `${c.closeTightness.toFixed(1)}%`.padEnd(12) +
            `${c.lowTightness.toFixed(1)}%`.padEnd(10) +
            `${c.touchCount}x`.padEnd(8) +
            `[${c.lastLows}] (Lantai: RM ${c.minLow.toFixed(3)})`
        );
    });
    
    console.log("\n=====================================================================");
}

run().catch(console.error);
