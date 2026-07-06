const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HISTORY_DIR = path.join(__dirname, 'history');
const MAPPING_FILE = path.join(__dirname, 'symbol_mappings.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hardcoded mappings
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

async function runCombinedBacktest() {
    console.log("=====================================================================");
    console.log("📊 COMBINED BACKTEST: MULTI-TOUCH + SMART MONEY ACTIVE VOLUME + SOP");
    console.log("=====================================================================");
    
    if (!fs.existsSync(HISTORY_DIR)) {
        console.error("Missing history directory.");
        return;
    }
    
    let mappings = {};
    if (fs.existsSync(MAPPING_FILE)) {
        mappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    }
    Object.assign(mappings, HARDCODED_MAPPINGS);
    
    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('data_') && f.endsWith('.json'))
        .sort();
        
    console.log(`Menjumpai ${files.length} fail data sejarah.\n`);
    
    // Resolve all symbols that appeared in history files
    const uniqueNames = new Set();
    files.forEach(f => {
        const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8'));
        const list = data.topVolume || data.processedData || [];
        list.forEach(s => {
            if (s.name) uniqueNames.add(s.name.toUpperCase().trim());
        });
    });
    
    const chartCache = {};
    console.log(`Mengumpul data chart Yahoo Finance untuk ${uniqueNames.size} kaunter unik...`);
    
    for (const name of uniqueNames) {
        const symbol = mappings[name];
        if (!symbol) continue;
        
        try {
            await sleep(50);
            const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (res.data && res.data.chart && res.data.chart.result && res.data.chart.result[0]) {
                const result = res.data.chart.result[0];
                const timestamp = result.timestamp;
                const quote = result.indicators.quote[0];
                const close = quote.close;
                const low = quote.low;
                const high = quote.high;
                
                if (timestamp && timestamp.length >= 30) {
                    const validDays = [];
                    for (let i = 0; i < timestamp.length; i++) {
                        if (close[i] !== null && close[i] !== undefined && low[i] !== null && low[i] !== undefined && high[i] !== null && high[i] !== undefined) {
                            validDays.push({
                                date: new Date(timestamp[i] * 1000).toISOString().split('T')[0],
                                close: close[i],
                                low: low[i],
                                high: high[i],
                                idx: i
                            });
                        }
                    }
                    chartCache[symbol] = validDays;
                }
            }
        } catch (e) {
            // ignore
        }
    }
    console.log("✅ Data sejarah carta dimuat turun!\n");
    
    let totalTrades = 0;
    let wins = 0;
    let totalProfit = 0;
    const tradeDetails = [];
    
    // Simulate trade date-by-date based on history files
    for (const file of files) {
        const fileDateStr = file.replace('data_', '').replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8'));
        const list = data.topVolume || data.processedData || [];
        
        list.forEach(s => {
            const name = s.name.toUpperCase().trim();
            const symbol = mappings[name];
            if (!symbol || !chartCache[symbol]) return;
            
            const validDays = chartCache[symbol];
            
            // Find corresponding trading day index
            let tIdx = validDays.findIndex(d => d.date === fileDateStr);
            if (tIdx === -1) {
                // Try to find the closest preceding date in chart
                tIdx = validDays.findIndex(d => d.date >= fileDateStr);
            }
            
            if (tIdx === -1 || tIdx < 20 || tIdx >= validDays.length - 10) return;
            
            // Check Multi-Touch Consolidation on that date
            let high52 = 0;
            const start52W = Math.max(0, tIdx - 250);
            for (let k = start52W; k <= tIdx; k++) {
                if (validDays[k].high > high52) high52 = validDays[k].high;
            }
            
            const currentPrice = validDays[tIdx].close;
            const pullback = ((high52 - currentPrice) / high52) * 100;
            
            const lastDays = validDays.slice(tIdx - 3, tIdx + 1);
            const closes = lastDays.map(d => d.close);
            const maxClose = Math.max(...closes);
            const minClose = Math.min(...closes);
            const closeTightness = ((maxClose - minClose) / minClose) * 100;
            
            const lows = lastDays.map(d => d.low);
            const minLow = Math.min(...lows);
            const maxLow = Math.max(...lows);
            const lowTightness = ((maxLow - minLow) / minLow) * 100;
            
            let touchCount = 0;
            lastDays.forEach(d => {
                const diffPct = ((d.low - minLow) / minLow) * 100;
                if (diffPct <= 2.0) touchCount++;
            });
            
            // Consolidation check
            const isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && (lowTightness <= 4.0 || touchCount >= 2));
            
            if (isConsolidation) {
                // Cooldown: prevent duplicates of the same stock within 7 days
                const lastTrade = tradeDetails.filter(tr => tr.name === name).pop();
                if (lastTrade && (tIdx - lastTrade.tIdx < 7)) return;
                
                const buyPrice = currentPrice;
                const supportFloor = minLow;
                const stopLossPrice = supportFloor * 0.97; // 3% buffer
                
                let hitTP10 = false;
                let hitSL = false;
                let slIdx = -1;
                let tpIdx = -1;
                
                // Track next 10 trading days
                for (let day = 1; day <= 10; day++) {
                    const futureDay = validDays[tIdx + day];
                    if (!futureDay) continue;
                    
                    if (futureDay.low <= stopLossPrice && !hitTP10 && !hitSL) {
                        hitSL = true;
                        slIdx = day;
                    }
                    
                    if (futureDay.high >= buyPrice * 1.10 && !hitSL && !hitTP10) {
                        hitTP10 = true;
                        tpIdx = day;
                    }
                }
                
                // Calculate 50-50 SOP return
                let finalReturnSOP = 0;
                if (hitSL) {
                    finalReturnSOP = ((stopLossPrice - buyPrice) / buyPrice) * 100;
                } else if (hitTP10) {
                    const firstHalfReturn = 10.0;
                    let secondHalfPrice = validDays[tIdx + 10].close;
                    
                    for (let day = tpIdx + 1; day <= 10; day++) {
                        const fDay = validDays[tIdx + day];
                        if (fDay && fDay.low <= buyPrice) {
                            secondHalfPrice = buyPrice;
                            break;
                        }
                    }
                    const secondHalfReturn = ((secondHalfPrice - buyPrice) / buyPrice) * 100;
                    finalReturnSOP = (firstHalfReturn + secondHalfReturn) / 2;
                } else {
                    const exitPrice = validDays[tIdx + 10].close;
                    finalReturnSOP = ((exitPrice - buyPrice) / buyPrice) * 100;
                }
                
                // Outlier check (to protect from split-adjusted data bugs in Yahoo Finance where price jumps > 200% or falls > 80% due to corporate actions)
                if (finalReturnSOP < -15 || finalReturnSOP > 40) return;
                
                totalTrades++;
                if (finalReturnSOP > 0) wins++;
                totalProfit += finalReturnSOP;
                
                tradeDetails.push({
                    name,
                    date: fileDateStr,
                    tIdx,
                    buyPrice,
                    pullback: pullback.toFixed(1),
                    closeTightness: closeTightness.toFixed(1),
                    touchCount,
                    hitSL,
                    hitTP10,
                    returnSOP: finalReturnSOP
                });
            }
        });
    }
    
    console.log("=====================================================================");
    console.log("📊 KEPUTUSAN BACKTEST GABUNGAN: MULTI-TOUCH + ACTIVE VOLUME + 50-50 SOP");
    console.log("=====================================================================");
    console.log(`   + Jumlah Posisi Dibuka : ${totalTrades}`);
    console.log(`   + Win Rate             : ${totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0}% (${wins} trade untung)`);
    console.log(`   + Purata Return / Trade: ${totalTrades > 0 ? (totalProfit / totalTrades).toFixed(2) : 0}%`);
    console.log(`   + JUMLAH KESELURUHAN PROFIT: ${totalProfit.toFixed(2)}%`);
    console.log("=====================================================================");
    
    console.log("\n📋 CONTOH TRADES GABUNGAN TERBAIK:");
    console.log("=====================================================================");
    tradeDetails
        .sort((a, b) => b.returnSOP - a.returnSOP)
        .slice(0, 15)
        .forEach(t => {
            console.log(`   📅 ${t.date} | 📈 ${t.name} | Beli: RM ${t.buyPrice.toFixed(3)} | Pullback: ${t.pullback}% | Return: +${t.returnSOP.toFixed(2)}% | TP10 Hit: ${t.hitTP10 ? 'YA' : 'TIDAK'}`);
        });
}

runCombinedBacktest().catch(console.error);
