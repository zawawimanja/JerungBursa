const fs = require('fs');
const path = require('path');
const axios = require('axios');

const IPO_DATA_PATH = '/home/awi/Desktop/ipohunterv2/data.json';
const MAPPING_FILE = path.join(__dirname, 'symbol_mappings.json');

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

// Save mapping cache
function saveMappings() {
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(symbolMappings, null, 2), 'utf8');
}

// Search Yahoo Finance for KLS symbol
async function resolveSymbol(name, idSymbol) {
    name = name.toUpperCase().trim();
    if (symbolMappings[name]) return symbolMappings[name];
    if (idSymbol && symbolMappings[idSymbol.toUpperCase()]) return symbolMappings[idSymbol.toUpperCase()];
    
    const queries = [name, `${name} KL`, idSymbol];
    for (const q of queries) {
        if (!q) continue;
        try {
            await sleep(150); // Be polite
            const response = await axios.get(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const quotes = response.data.quotes || [];
            const bursaQuote = quotes.find(quote => quote.exchange === 'KLS');
            if (bursaQuote) {
                symbolMappings[name] = bursaQuote.symbol;
                console.log(`Resolved: ${name} -> ${bursaQuote.symbol}`);
                saveMappings();
                return bursaQuote.symbol;
            }
        } catch (e) {
            // Quiet fail, try next query
        }
    }
    return null;
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
            const currentPrice = metaValue(result.meta.regularMarketPrice, close);
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
        // Quiet fail
    }
    return null;
}

function metaValue(meta, arr) {
    if (meta !== undefined && meta !== null) return meta;
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] !== null && arr[i] !== undefined) return arr[i];
    }
    return 0;
}

async function run() {
    console.log("=====================================================================");
    console.log("🔍 BURSA IPO HUNTER - ALL LISTED IPO SCANNER");
    console.log("=====================================================================");
    
    // 1. Read IPO database
    if (!fs.existsSync(IPO_DATA_PATH)) {
        console.error(`File not found: ${IPO_DATA_PATH}`);
        return;
    }
    
    const ipos = JSON.parse(fs.readFileSync(IPO_DATA_PATH, 'utf8'));
    const listedIpos = ipos.filter(x => x.stage === 5 || x.status === "Listed");
    
    console.log(`Menjumpai ${listedIpos.length} kaunter IPO yang sudah disenaraikan dalam pangkalan data...\n`);
    
    // 2. Resolve and Scan
    const results = [];
    
    for (const ipo of listedIpos) {
        const name = ipo.companyName;
        const symbolField = ipo.symbol;
        
        const yahooSymbol = await resolveSymbol(name, symbolField);
        if (!yahooSymbol) {
            // console.log(`⚠️ Gagal mencari kod untuk: ${name}`);
            continue;
        }
        
        const chartData = await fetchChart(yahooSymbol);
        if (!chartData) {
            // console.log(`⚠️ Gagal memuat turun data carta untuk: ${yahooSymbol}`);
            continue;
        }
        
        const pullback = ((chartData.high52 - chartData.currentPrice) / chartData.high52) * 100;
        
        let setup = 'Avoid / Downtrend';
        if (pullback >= 0 && pullback <= 5.0) setup = 'RBS Retest';
        else if (pullback > 5.0 && pullback <= 15.0) setup = 'Healthy Dip';
        else if (pullback > 15.0 && pullback <= 30.0) setup = 'Deep Pullback';
        
        results.push({
            name: symbolField || name,
            companyName: name,
            symbol: yahooSymbol,
            price: chartData.currentPrice,
            changePct: chartData.changePct,
            high52: chartData.high52,
            pullback: pullback,
            setup: setup,
            turnover: chartData.turnover,
            predictedGrade: ipo.predictedGrade || 'N/A'
        });
    }
    
    // Sort results by pullback percentage
    results.sort((a, b) => a.pullback - b.pullback);
    
    // 3. Print categorized results
    console.log("\n=====================================================================");
    console.log("📋 HASIL IMBASAN SETIAP KATEGORI PULLBACK IPO 2026");
    console.log("=====================================================================");
    
    const printCategory = (title, setupName) => {
        console.log(`\n⭐️ ${title.toUpperCase()}:`);
        console.log("-".repeat(85));
        console.log(
            "KAUNTER".padEnd(12) + 
            "GRED".padEnd(8) + 
            "HARGA".padEnd(10) + 
            "CHANGE".padEnd(10) + 
            "PULLBACK".padEnd(12) + 
            "52W HIGH".padEnd(12) + 
            "TURNOVER (RM)"
        );
        console.log("-".repeat(85));
        
        const filtered = results.filter(x => x.setup === setupName);
        if (filtered.length === 0) {
            console.log("  (Tiada kaunter dikesan dalam kategori ini)");
            return;
        }
        
        filtered.forEach(x => {
            const trStr = x.turnover >= 1000000 
                ? `${(x.turnover / 1000000).toFixed(2)}M` 
                : `${(x.turnover / 1000).toFixed(0)}K`;
            
            console.log(
                x.name.padEnd(12) +
                x.predictedGrade.padEnd(8) +
                `RM ${x.price.toFixed(3)}`.padEnd(10) +
                `${x.changePct >= 0 ? '+' : ''}${x.changePct.toFixed(2)}%`.padEnd(10) +
                `${x.pullback.toFixed(2)}%`.padEnd(12) +
                `RM ${x.high52.toFixed(3)}`.padEnd(12) +
                trStr
            );
        });
    };
    
    printCategory("1. RBS Retest (Pullback 0% - 5%) - Near ATH/Breakout", "RBS Retest");
    printCategory("2. Healthy Dip (Pullback 5% - 15%) - Consolidation Sihat", "Healthy Dip");
    printCategory("3. Deep Pullback (Pullback 15% - 30%) - Sesuai Beli Support", "Deep Pullback");
    printCategory("4. Downtrend / Avoid (Pullback > 30%) - Risiko Kejatuhan Bebas", "Avoid / Downtrend");
    
    console.log("\n=====================================================================");
}

run().catch(console.error);
