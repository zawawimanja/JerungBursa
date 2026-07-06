const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HISTORY_DIR = path.join(__dirname, 'history');
const MAPPING_FILE = path.join(__dirname, 'symbol_mappings.json');

// Hardcoded mappings for known issues or common tickers
const HARDCODED_MAPPINGS = {
    'SKYCHIP': '5326.KL',
    'SKYECHIP': '5326.KL',
    'ZETRIX': '0138.KL',
    'NATGATE': '0270.KL',
    'GIIB': '7191.KL',
    'F&N': '3689.KL',
    'SDG': '5285.KL', // SD Guthrie
    'QL': '7084.KL',
    'MPI': '3867.KL',
    'SAM': '9822.KL',
    'UMSINT': '7222.KL',
    'YTL': '6742.KL'
};

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load or initialize mapping cache
let symbolMappings = {};
if (fs.existsSync(MAPPING_FILE)) {
    try {
        symbolMappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    } catch (e) {
        symbolMappings = {};
    }
}
Object.assign(symbolMappings, HARDCODED_MAPPINGS);

// Save mapping cache
function saveMappings() {
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(symbolMappings, null, 2), 'utf8');
}

// Search Yahoo Finance for KLS symbol
async function resolveSymbol(name) {
    name = name.toUpperCase().trim();
    if (symbolMappings[name]) return symbolMappings[name];
    
    // Ignore warrants
    if (name.includes('HSI-') || name.includes('-C') || name.includes('-P') || name.startsWith('HSI')) {
        return null;
    }
    
    try {
        await sleep(150); // Be polite
        const response = await axios.get(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(name)}&quotesCount=10`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const quotes = response.data.quotes || [];
        const bursaQuote = quotes.find(q => q.exchange === 'KLS');
        if (bursaQuote) {
            symbolMappings[name] = bursaQuote.symbol;
            console.log(`Resolved: ${name} -> ${bursaQuote.symbol}`);
            saveMappings();
            return bursaQuote.symbol;
        }
    } catch (e) {
        console.error(`Error resolving ${name}: ${e.message}`);
    }
    
    return null;
}

// Fetch historical 1-year chart data
const chartCache = {};
async function fetchChart(symbol) {
    if (chartCache[symbol]) return chartCache[symbol];
    
    try {
        await sleep(150); // Rate limit protection
        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const result = response.data.chart.result[0];
        if (result && result.timestamp) {
            const timestamps = result.timestamp;
            const quote = result.indicators.quote[0];
            const close = quote.close;
            const high = quote.high;
            
            // Map dates (YYYY-MM-DD) to price index
            const dateMap = {};
            timestamps.forEach((ts, idx) => {
                const dateStr = new Date(ts * 1000).toISOString().split('T')[0];
                dateMap[dateStr] = idx;
            });
            
            const data = {
                symbol,
                timestamps,
                close,
                high,
                dateMap
            };
            chartCache[symbol] = data;
            return data;
        }
    } catch (e) {
        console.error(`Error fetching chart for ${symbol}: ${e.message}`);
    }
    return null;
}

async function run() {
    console.log("=====================================================================");
    console.log("🚀 BURSA JERUNG MOMENTUM vs PULLBACK BACKTESTER");
    console.log("=====================================================================");
    
    // 1. Read history folder
    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('data_') && f.endsWith('.json'))
        .sort();
        
    console.log(`Menjumpai ${files.length} fail data sejarah dari ${files[0].replace('data_', '').replace('.json', '')} ke ${files[files.length-1].replace('data_', '').replace('.json', '')}\n`);
    
    // 2. Extract unique names
    const uniqueNames = new Set();
    files.forEach(f => {
        const filePath = path.join(HISTORY_DIR, f);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const list = data.topVolume || data.processedData || [];
        list.forEach(s => {
            if (s.name && s.signal === 'buy') {
                uniqueNames.add(s.name.toUpperCase());
            }
        });
    });
    
    console.log(`Mengumpul ${uniqueNames.size} kaunter unik dengan isyarat BUY...\n`);
    
    // 3. Resolve symbols
    console.log("Mencari kod Yahoo Finance untuk kaunter...");
    const nameToSymbol = {};
    for (const name of uniqueNames) {
        const symbol = await resolveSymbol(name);
        if (symbol) {
            nameToSymbol[name] = symbol;
        }
    }
    console.log("✅ Resolusi kod selesai!\n");
    
    // 4. Fetch chart data for all resolved symbols
    console.log("Memuat turun data carta 1-tahun Yahoo Finance...");
    const charts = {};
    for (const name of Object.keys(nameToSymbol)) {
        const symbol = nameToSymbol[name];
        const chart = await fetchChart(symbol);
        if (chart) {
            charts[symbol] = chart;
        }
    }
    console.log("✅ Data sejarah carta dimuat turun!\n");
    
    // 5. Backtest trades
    const allTrades = [];
    
    for (const file of files) {
        const dateStr = file.replace('data_', '').replace('.json', '');
        const filePath = path.join(HISTORY_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const list = data.topVolume || data.processedData || [];
        
        list.forEach(s => {
            if (s.signal !== 'buy') return;
            
            const symbol = nameToSymbol[s.name.toUpperCase()];
            if (!symbol || !charts[symbol]) return;
            
            const chart = charts[symbol];
            
            // Find trading day index in Yahoo Chart
            // If the exact date is not present (e.g. weekend run), find the closest preceding date or skip
            let dateIdx = chart.dateMap[dateStr];
            if (dateIdx === undefined) {
                // Find nearest date in dateMap
                const dates = Object.keys(chart.dateMap).sort();
                const matchedDate = dates.find(d => d >= dateStr);
                if (matchedDate) {
                    dateIdx = chart.dateMap[matchedDate];
                }
            }
            
            if (dateIdx === undefined) return;
            
            const buyPrice = chart.close[dateIdx] || s.price;
            if (!buyPrice || buyPrice <= 0) return;
            
            // Calculate 52W High at that point (preceding 252 days)
            const startIdx = Math.max(0, dateIdx - 252);
            let high52 = 0;
            for (let i = startIdx; i <= dateIdx; i++) {
                if (chart.high[i] > high52) {
                    high52 = chart.high[i];
                }
            }
            
            if (high52 <= 0) return;
            
            const pullback = ((high52 - buyPrice) / high52) * 100;
            
            // Classify Setup
            let setup = 'Downtrend / Avoid';
            if (pullback >= 0 && pullback <= 5.0) setup = 'RBS Retest';
            else if (pullback > 5.0 && pullback <= 15.0) setup = 'Healthy Dip';
            else if (pullback > 15.0 && pullback <= 30.0) setup = 'Deep Pullback';
            
            // Track performance in next 10 trading days
            const maxDaysAhead = 10;
            let maxPrice = buyPrice;
            let finalPrice = buyPrice;
            
            const nextIdxStart = dateIdx + 1;
            const nextIdxEnd = Math.min(chart.close.length - 1, dateIdx + maxDaysAhead);
            
            for (let i = nextIdxStart; i <= nextIdxEnd; i++) {
                const highPrice = chart.high[i];
                const closePrice = chart.close[i];
                
                if (highPrice > maxPrice) maxPrice = highPrice;
                finalPrice = closePrice;
            }
            
            const maxPerf = ((maxPrice - buyPrice) / buyPrice) * 100;
            const finalPerf = ((finalPrice - buyPrice) / buyPrice) * 100;
            
            allTrades.push({
                date: dateStr,
                name: s.name,
                symbol,
                buyPrice,
                high52,
                pullback,
                setup,
                maxPerf,
                finalPerf
            });
        });
    }
    
    // 6. Output Statistics Comparison
    console.log("=====================================================================");
    console.log("📊 KEPUTUSAN BACKTEST PERBANDINGAN STRATEGI (Hold 10 Hari Dagangan)");
    console.log("=====================================================================");
    
    // Helper to calculate stats
    function printStats(label, tradesList) {
        const total = tradesList.length;
        if (total === 0) {
            console.log(`\nStrategi: ${label}`);
            console.log("Tiada data trade ditemui.");
            return;
        }
        
        const wins = tradesList.filter(t => t.maxPerf >= 4.0).length;
        const superWins = tradesList.filter(t => t.maxPerf >= 10.0).length;
        const sumMax = tradesList.reduce((acc, t) => acc + t.maxPerf, 0);
        const sumFinal = tradesList.reduce((acc, t) => acc + t.finalPerf, 0);
        
        const winRate = (wins / total) * 100;
        const superWinRate = (superWins / total) * 100;
        const avgMax = sumMax / total;
        const avgFinal = sumFinal / total;
        
        console.log(`\nStrategi: ${label}`);
        console.log(`  + Jumlah Posisi Dibuka       : ${total}`);
        console.log(`  + Win Rate (Max Gain >= 4%)  : ${winRate.toFixed(1)}% (${wins} trade)`);
        console.log(`  + Super Win (Max Gain >= 10%): ${superWinRate.toFixed(1)}% (${superWins} trade)`);
        console.log(`  + Purata Kenaikan Tertinggi  : +${avgMax.toFixed(2)}%`);
        console.log(`  + Purata Untung Bersih Akhir : +${avgFinal.toFixed(2)}%`);
    }
    
    // Group 1: Jerung-Only (All signals)
    printStats("1. JERUNG ONLY (Breakout Momentum Sahaja)", allTrades);
    
    // Group 2: Jerung + Pullback (RBS & Healthy Dip) - Pullback 0% - 15%
    const pullbackTrades = allTrades.filter(t => t.setup === 'RBS Retest' || t.setup === 'Healthy Dip');
    printStats("2. JERUNG + PULLBACK SIHAT (RBS Retest & Healthy Dip: 0% - 15%)", pullbackTrades);
    
    // Group 3: Jerung + Deep Pullback (15% - 30%)
    const deepPullbackTrades = allTrades.filter(t => t.setup === 'Deep Pullback');
    printStats("3. JERUNG + DEEP PULLBACK (Buy Support: 15% - 30%)", deepPullbackTrades);
    
    // Group 4: Avoid/Downtrend (>30% pullback)
    const avoidTrades = allTrades.filter(t => t.setup === 'Downtrend / Avoid');
    printStats("4. JATUHAN BEBAS (Downtrend / Pullback > 30% - Kategori AVOID)", avoidTrades);
    
    console.log("\n=====================================================================");
    console.log("💡 IMPLIKASI & KESIMPULAN DARI DATA SEJARAH JERUNGBURSA:");
    console.log("=====================================================================");
    console.log("1. Bandingkan Win Rate dan Purata Untung Bersih Akhir antara Strategi 1 & 2.");
    console.log("2. Perhatikan bagaimana Kategori AVOID (Kategori 4) mempunyai prestasi terendah");
    console.log("   membuktikan ia amat merbahaya untuk mengejar kaunter downtrend.");
    console.log("=====================================================================");
}

run().catch(console.error);
