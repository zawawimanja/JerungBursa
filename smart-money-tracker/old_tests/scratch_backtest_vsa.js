const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MAPPING_FILE = path.join(__dirname, 'symbol_mappings.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runVSABacktest() {
    console.log("=====================================================================");
    console.log("📊 VSA BACKTEST: MULTI-TOUCH CONSOLIDATION + VOLUME FILTRATION (1 YEAR)");
    console.log("=====================================================================");
    
    if (!fs.existsSync(MAPPING_FILE)) {
        console.error("Missing mappings file.");
        return;
    }
    const mappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    const allSymbols = Object.keys(mappings);
    
    console.log(`Mengimbas ${allSymbols.length} kaunter menggunakan penapis VSA (Volume Spike + Turnover > RM1M)...`);
    
    let totalTrades = 0;
    let wins = 0;
    let totalProfit = 0;
    const tradeDetails = [];
    
    for (const name of allSymbols) {
        const symbol = mappings[name];
        if (!symbol) continue;
        
        try {
            await sleep(50);
            const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            if (!res.data || !res.data.chart || !res.data.chart.result || !res.data.chart.result[0]) continue;
            
            const result = res.data.chart.result[0];
            const timestamp = result.timestamp;
            const quote = result.indicators.quote[0];
            const close = quote.close;
            const low = quote.low;
            const high = quote.high;
            const volume = quote.volume;
            
            if (!timestamp || timestamp.length < 50) continue;
            
            const validDays = [];
            for (let i = 0; i < timestamp.length; i++) {
                if (close[i] !== null && close[i] !== undefined && 
                    low[i] !== null && low[i] !== undefined && 
                    high[i] !== null && high[i] !== undefined &&
                    volume[i] !== null && volume[i] !== undefined) {
                    validDays.push({
                        date: new Date(timestamp[i] * 1000).toISOString().split('T')[0],
                        close: close[i],
                        low: low[i],
                        high: high[i],
                        volume: volume[i]
                    });
                }
            }
            
            if (validDays.length < 40) continue;
            
            // Scan history
            for (let t = 20; t < validDays.length - 10; t++) {
                // Calculate 20-day average volume (excluding current day t)
                let sumVol = 0;
                for (let k = t - 20; k < t; k++) {
                    sumVol += validDays[k].volume;
                }
                const avgVol = sumVol / 20;
                
                // VSA Volume Filter:
                // 1. Volume spike on day t (volume > 1.5x average)
                // 2. Liquidity check: turnover (close * volume) > RM 1,000,000 (1 Million)
                const volumeSpike = validDays[t].volume > 1.5 * avgVol;
                const turnover = validDays[t].close * validDays[t].volume;
                const hasLiquidity = turnover >= 1000000;
                
                if (!volumeSpike || !hasLiquidity) continue;
                
                // Multi-Touch Consolidation check
                let high52 = 0;
                const start52W = Math.max(0, t - 250);
                for (let k = start52W; k <= t; k++) {
                    if (validDays[k].high > high52) high52 = validDays[k].high;
                }
                
                const currentPrice = validDays[t].close;
                const pullback = ((high52 - currentPrice) / high52) * 100;
                
                const lastDays = validDays.slice(t - 3, t + 1);
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
                
                const isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && (lowTightness <= 4.0 || touchCount >= 2));
                
                if (isConsolidation) {
                    const lastTrade = tradeDetails.filter(tr => tr.name === name).pop();
                    if (lastTrade && (t - lastTrade.tIdx < 10)) continue; // 10 days cooldown
                    
                    const buyPrice = currentPrice;
                    const supportFloor = minLow;
                    const stopLossPrice = supportFloor * 0.97;
                    
                    let hitTP10 = false;
                    let hitSL = false;
                    let slIdx = -1;
                    let tpIdx = -1;
                    
                    for (let day = 1; day <= 10; day++) {
                        const futureDay = validDays[t + day];
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
                    
                    let finalReturnSOP = 0;
                    if (hitSL) {
                        finalReturnSOP = ((stopLossPrice - buyPrice) / buyPrice) * 100;
                    } else if (hitTP10) {
                        const firstHalfReturn = 10.0;
                        let secondHalfPrice = validDays[t + 10].close;
                        
                        for (let day = tpIdx + 1; day <= 10; day++) {
                            const fDay = validDays[t + day];
                            if (fDay && fDay.low <= buyPrice) {
                                secondHalfPrice = buyPrice;
                                break;
                            }
                        }
                        const secondHalfReturn = ((secondHalfPrice - buyPrice) / buyPrice) * 100;
                        finalReturnSOP = (firstHalfReturn + secondHalfReturn) / 2;
                    } else {
                        const exitPrice = validDays[t + 10].close;
                        finalReturnSOP = ((exitPrice - buyPrice) / buyPrice) * 100;
                    }
                    
                    // Filter outlier data splits
                    if (finalReturnSOP < -15 || finalReturnSOP > 40) continue;
                    
                    totalTrades++;
                    if (finalReturnSOP > 0) wins++;
                    totalProfit += finalReturnSOP;
                    
                    tradeDetails.push({
                        name,
                        date: validDays[t].date,
                        tIdx: t,
                        buyPrice,
                        pullback: pullback.toFixed(1),
                        closeTightness: closeTightness.toFixed(1),
                        touchCount,
                        hitSL,
                        hitTP10,
                        returnSOP: finalReturnSOP
                    });
                }
            }
            
        } catch (err) {
            // ignore
        }
    }
    
    console.log("=====================================================================");
    console.log("📊 KEPUTUSAN BACKTEST VSA GABUNGAN (1 TAHUN, PASARAN LUAS)");
    console.log("=====================================================================");
    console.log(`   + Jumlah Posisi Dibuka : ${totalTrades}`);
    console.log(`   + Win Rate             : ${totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0}% (${wins} trade untung)`);
    console.log(`   + Purata Return / Trade: ${totalTrades > 0 ? (totalProfit / totalTrades).toFixed(2) : 0}%`);
    console.log(`   + JUMLAH KESELURUHAN PROFIT: ${totalProfit.toFixed(2)}%`);
    console.log("=====================================================================");
    
    console.log("\n📋 KEMASUKAN TERBAIK VSA (1 TAHUN):");
    console.log("=====================================================================");
    tradeDetails
        .sort((a, b) => b.returnSOP - a.returnSOP)
        .slice(0, 15)
        .forEach(t => {
            console.log(`   📅 ${t.date} | 📈 ${t.name} | Beli: RM ${t.buyPrice.toFixed(3)} | Pullback: ${t.pullback}% | Return: +${t.returnSOP.toFixed(2)}% | TP10 Hit: ${t.hitTP10 ? 'YA' : 'TIDAK'}`);
        });
}

runVSABacktest().catch(console.error);
