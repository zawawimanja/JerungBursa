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

// Load mapping cache
let symbolMappings = {};
if (fs.existsSync(MAPPING_FILE)) {
    try {
        symbolMappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    } catch (e) {
        symbolMappings = {};
    }
}

// Fetch chart data
async function fetchChart(symbol) {
    try {
        await sleep(150);
        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const result = response.data.chart.result[0];
        if (result && result.timestamp) {
            const timestamps = result.timestamp;
            const quote = result.indicators.quote[0];
            const close = quote.close;
            const high = quote.high;
            
            // Get latest price
            let currentPrice = result.meta.regularMarketPrice;
            if (currentPrice === undefined || currentPrice === null) {
                for (let i = close.length - 1; i >= 0; i--) {
                    if (close[i] !== null && close[i] !== undefined) {
                        currentPrice = close[i];
                        break;
                    }
                }
            }
            
            const prevClose = result.meta.chartPreviousClose || currentPrice;
            const changePct = ((currentPrice - prevClose) / prevClose) * 100;
            const dailyVolume = result.meta.regularMarketVolume || 0;
            const turnover = dailyVolume * currentPrice;
            
            // Calculate 52W High
            let high52 = 0;
            high.forEach(h => {
                if (h > high52) high52 = h;
            });
            
            return {
                currentPrice,
                changePct,
                high52,
                turnover,
                dailyVolume
            };
        }
    } catch (e) {
        // console.error(`Error fetching chart for ${symbol}: ${e.message}`);
    }
    return null;
}

async function run() {
    console.log("=====================================================================");
    console.log("📊 BURSA JERUNG MOMENTUM - USER WATCHLIST PULLBACK SCANNER");
    console.log("=====================================================================");
    console.log(`Mengimbas ${watchlist.length} kaunter dari watchlist TradingView anda...\n`);
    
    const results = [];
    
    for (const name of watchlist) {
        const symbol = symbolMappings[name.toUpperCase()];
        if (!symbol) {
            console.log(`⚠️ Simbol untuk ${name} tiada dalam pemetaan. Melangkau...`);
            continue;
        }
        
        const data = await fetchChart(symbol);
        if (!data) {
            console.log(`⚠️ Gagal menarik data Yahoo Finance untuk ${name} (${symbol})`);
            continue;
        }
        
        const pullback = ((data.high52 - data.currentPrice) / data.high52) * 100;
        
        let setup = 'Avoid / Downtrend';
        if (pullback >= 0 && pullback <= 5.0) setup = 'RBS Retest';
        else if (pullback > 5.0 && pullback <= 15.0) setup = 'Healthy Dip';
        else if (pullback > 15.0 && pullback <= 30.0) setup = 'Deep Pullback';
        
        results.push({
            name,
            symbol,
            price: data.currentPrice,
            changePct: data.changePct,
            high52: data.high52,
            pullback,
            setup,
            turnover: data.turnover
        });
    }
    
    // Sort by pullback percentage
    results.sort((a, b) => a.pullback - b.pullback);
    
    console.log("\n=====================================================================");
    console.log("📋 KEPUTUSAN IMBASAN WATCHLIST ANDA (Disusun dari Pullback Terkecil)");
    console.log("=====================================================================");
    
    const printCategory = (title, setupName) => {
        const filtered = results.filter(x => x.setup === setupName);
        console.log(`\n⭐️ ${title.toUpperCase()}:`);
        console.log("-".repeat(80));
        console.log(
            "KAUNTER".padEnd(12) + 
            "HARGA".padEnd(10) + 
            "CHANGE".padEnd(10) + 
            "PULLBACK".padEnd(12) + 
            "52W HIGH".padEnd(12) + 
            "TURNOVER"
        );
        console.log("-".repeat(80));
        
        if (filtered.length === 0) {
            console.log("  (Tiada kaunter dalam kategori ini)");
            return;
        }
        
        filtered.forEach(x => {
            const trStr = x.turnover >= 1000000 
                ? `${(x.turnover / 1000000).toFixed(2)}M` 
                : `${(x.turnover / 1000).toFixed(0)}K`;
                
            console.log(
                x.name.padEnd(12) +
                `RM ${x.price.toFixed(3)}`.padEnd(10) +
                `${x.changePct >= 0 ? '+' : ''}${x.changePct.toFixed(2)}%`.padEnd(10) +
                `${x.pullback.toFixed(2)}%`.padEnd(12) +
                `RM ${x.high52.toFixed(3)}`.padEnd(12) +
                trStr
            );
        });
    };
    
    printCategory("1. RBS Retest (Pullback 0% - 5%) - Sedia Breakout", "RBS Retest");
    printCategory("2. Healthy Dip (Pullback 5% - 15%) - Consolidation Sihat", "Healthy Dip");
    printCategory("3. Deep Pullback (Pullback 15% - 30%) - Sesuai Beli Support", "Deep Pullback");
    printCategory("4. Downtrend / Avoid (Pullback > 30%) - Risiko Tinggi", "Avoid / Downtrend");
    
    console.log("\n=====================================================================");
}

run().catch(console.error);
