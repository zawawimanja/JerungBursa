const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HISTORY_DIR = path.join(__dirname, '../history');
const MAPPING_FILE = path.join(__dirname, '../symbol_mappings.json');
const HTML_FILE = path.join(__dirname, '../backtest.html');

const HARDCODED_MAPPINGS = {
    'SKYCHIP': '5326.KL',
    'SKYECHIP': '5326.KL',
    'ZETRIX': '0138.KL',
    'NATGATE': '0270.KL',
    'GIIB': '7191.KL',
    'F&N': '3689.KL',
    'SDG': '5285.KL',
    'QL': '7084.KL',
    'MPI': '3867.KL',
    'SAM': '9822.KL',
    'UMSINT': '7222.KL',
    'YTL': '6742.KL'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let symbolMappings = {};
if (fs.existsSync(MAPPING_FILE)) {
    try {
        symbolMappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    } catch (e) {
        symbolMappings = {};
    }
}
Object.assign(symbolMappings, HARDCODED_MAPPINGS);

function saveMappings() {
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(symbolMappings, null, 2), 'utf8');
}

async function resolveSymbol(name) {
    name = name.toUpperCase().trim();
    if (symbolMappings[name]) return symbolMappings[name];
    if (name.includes('HSI-') || name.includes('-C') || name.includes('-P') || name.startsWith('HSI')) {
        return null;
    }
    try {
        await sleep(100);
        const response = await axios.get(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(name)}&quotesCount=10`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
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

const chartCache = {};
async function fetchChart(symbol) {
    if (chartCache[symbol]) return chartCache[symbol];
    try {
        await sleep(100);
        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const result = response.data.chart.result[0];
        if (result && result.timestamp) {
            const timestamps = result.timestamp;
            const quote = result.indicators.quote[0];
            const close = quote.close;
            const high = quote.high;
            const low = quote.low;
            
            const dateMap = {};
            timestamps.forEach((ts, idx) => {
                const dateStr = new Date(ts * 1000).toISOString().split('T')[0];
                dateMap[dateStr] = idx;
            });
            
            const data = { symbol, timestamps, close, high, low, dateMap };
            chartCache[symbol] = data;
            return data;
        }
    } catch (e) {
        console.error(`Error fetching chart for ${symbol}: ${e.message}`);
    }
    return null;
}

async function compile() {
    console.log("🔍 Memulakan pengesahan dan kompilasi data backtest...");
    
    // Read history files starting from 2026-06-22
    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('data_') && f.endsWith('.json'))
        .sort();
        
    const targetFiles = files.filter(f => {
        const dateStr = f.replace('data_', '').replace('.json', '');
        return dateStr >= '2026-06-22';
    });
    
    // Remove the latest file because we cannot forward-test it yet (no future data)
    if (targetFiles.length > 0) {
        targetFiles.pop();
    }
    
    console.log(`Menjumpai ${targetFiles.length} fail data sejarah dari ${targetFiles[0]} ke ${targetFiles[targetFiles.length-1]}`);
    
    // Extract unique symbols to pre-resolve
    const uniqueNames = new Set();
    for (const file of targetFiles) {
        const filePath = path.join(HISTORY_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const list = data.topVolume || data.processedData || [];
        
        list.forEach(item => {
            const pullbackVal = item.pullback !== null ? item.pullback : 0;
            const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
            const maxPullback = isAboveSma200 ? 40.0 : 30.0;
            
            const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullback;
            const isBouncing = item.change > 0;
            const isDowntrend = item.setupName && (
                item.setupName.includes('Downtrend') || 
                item.setupName.includes('Avoid') || 
                item.setupName === 'N/A'
            );
            
            const passFilters = hasPullback && 
                   isBouncing && 
                   !isDowntrend && 
                   item.price >= 0.25 && item.price <= 4.00 && 
                   item.turnover >= 250000 && 
                   !item.isCombStock &&
                   (item.setupStyle === 'EXPLOSIVE' || item.setupStyle === 'STAIRCASE');
                   
            if (passFilters) {
                uniqueNames.add(item.name.toUpperCase());
            }
        });
    }
    
    console.log(`Mengumpul ${uniqueNames.size} kaunter unik yang mematuhi tapisan SOP...`);
    
    // Resolve symbols
    const nameToSymbol = {};
    for (const name of uniqueNames) {
        const symbol = await resolveSymbol(name);
        if (symbol) {
            nameToSymbol[name] = symbol;
        }
    }
    
    // Fetch chart data
    console.log("Memuat turun data pasaran dari Yahoo Finance...");
    const charts = {};
    for (const name of Object.keys(nameToSymbol)) {
        const symbol = nameToSymbol[name];
        const chart = await fetchChart(symbol);
        if (chart) {
            charts[symbol] = chart;
        }
    }
    
    const allTrades = [];
    
    for (const file of targetFiles) {
        const dateStr = file.replace('data_', '').replace('.json', '');
        const filePath = path.join(HISTORY_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const list = data.topVolume || data.processedData || [];
        
        const processedSymbolsThisDate = new Set();
        
        list.forEach(item => {
            const pullbackVal = item.pullback !== null ? item.pullback : 0;
            const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
            const maxPullback = isAboveSma200 ? 40.0 : 30.0;
            
            const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullback;
            const isBouncing = item.change > 0;
            const isDowntrend = item.setupName && (
                item.setupName.includes('Downtrend') || 
                item.setupName.includes('Avoid') || 
                item.setupName === 'N/A'
            );
            
            const passFilters = hasPullback && 
                   isBouncing && 
                   !isDowntrend && 
                   item.price >= 0.25 && item.price <= 4.00 && 
                   item.turnover >= 250000 && 
                   !item.isCombStock &&
                   (item.setupStyle === 'EXPLOSIVE' || item.setupStyle === 'STAIRCASE');
                   
            if (!passFilters) return;
            
            const symbol = nameToSymbol[item.name.toUpperCase()];
            if (!symbol || !charts[symbol]) return;
            
            // Deduplicate by symbol per date
            if (processedSymbolsThisDate.has(symbol)) return;
            processedSymbolsThisDate.add(symbol);
            
            const chart = charts[symbol];
            
            let dateIdx = chart.dateMap[dateStr];
            if (dateIdx === undefined) {
                const dates = Object.keys(chart.dateMap).sort();
                const matchedDate = dates.find(d => d >= dateStr);
                if (matchedDate) {
                    dateIdx = chart.dateMap[matchedDate];
                }
            }
            
            if (dateIdx === undefined) return;
            
            const entryPrice = chart.close[dateIdx] || item.price;
            if (!entryPrice || entryPrice <= 0) return;
            
            // Support Floor & SL Calculation
            const supportFloor = item.floorLow || (entryPrice * 0.95);
            const stopLossPrice = supportFloor * 0.97;
            
            // Track performance in next 10 trading days
            const maxDaysAhead = 10;
            const nextIdxStart = dateIdx + 1;
            const nextIdxEnd = Math.min(chart.close.length - 1, dateIdx + maxDaysAhead);
            
            let isSlHit = false;
            let maxHigh = entryPrice;
            let finalPrice = entryPrice;
            let slHitIdx = -1;
            
            for (let i = nextIdxStart; i <= nextIdxEnd; i++) {
                const dayHigh = chart.high[i];
                const dayLow = chart.low[i];
                const dayClose = chart.close[i];
                
                if (dayLow !== null && dayLow !== undefined && dayLow <= stopLossPrice && !isSlHit) {
                    isSlHit = true;
                    slHitIdx = i;
                    finalPrice = stopLossPrice;
                }
                
                if (!isSlHit) {
                    if (dayHigh !== null && dayHigh !== undefined && dayHigh > maxHigh) maxHigh = dayHigh;
                    if (dayClose !== null && dayClose !== undefined) finalPrice = dayClose;
                }
            }
            
            const maxGain = entryPrice > 0 ? (((maxHigh - entryPrice) / entryPrice) * 100) : 0;
            let finalGain = entryPrice > 0 ? (((finalPrice - entryPrice) / entryPrice) * 100) : 0;
            
            let status = 'FLAT';
            if (isSlHit) {
                status = 'SL_HIT';
            } else if (finalGain >= 5.0) {
                status = 'PROFIT_BIG';
            } else if (finalGain > 0.0) {
                status = 'PROFIT';
            } else if (finalGain < 0.0) {
                status = 'LOSS';
            }
            
            allTrades.push({
                date: dateStr,
                name: item.name,
                style: item.setupStyle,
                entryPrice,
                finalPrice,
                maxGain,
                finalGain,
                status,
                turnover: item.turnover || 0
            });
        });
    }
    
    console.log(`Kompilasi selesai! Menghasilkan ${allTrades.length} rekod trade.`);
    
    // Read html, write trades list
    if (!fs.existsSync(HTML_FILE)) {
        console.error("❌ backtest.html tiada!");
        return;
    }
    
    let htmlContent = fs.readFileSync(HTML_FILE, 'utf8');
    
    const regex = /(\/\/ Data generated dynamically from the backtest compiler script\r?\n\s*const fullData = \[\r?\n)([\s\S]*?)(\s*\];)/;
    
    const formattedData = allTrades.map(t => {
        return `            { date: '${t.date}', name: '${t.name}', style: '${t.style}', entryPrice: ${t.entryPrice.toFixed(3)}, finalPrice: ${t.finalPrice.toFixed(3)}, maxGain: ${t.maxGain.toFixed(2)}, finalGain: ${t.finalGain.toFixed(2)}, status: '${t.status}', turnover: ${t.turnover} }`;
    }).join(',\n');
    
    const newScriptSection = `// Data generated dynamically from the backtest compiler script\n        const fullData = [\n${formattedData}\n        ];`;
    
    htmlContent = htmlContent.replace(/\/\/ Data generated dynamically from the backtest compiler script[\s\S]*?const fullData = \[\s*([\s\S]*?)\s*\];/, newScriptSection);
    
    fs.writeFileSync(HTML_FILE, htmlContent, 'utf8');
    console.log("✅ Laman web backtest.html berjaya dikemas kini!");
}

compile().catch(console.error);
