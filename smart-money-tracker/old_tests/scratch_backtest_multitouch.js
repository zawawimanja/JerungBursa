const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MAPPING_FILE = path.join(__dirname, 'symbol_mappings.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runBacktest() {
    console.log("=====================================================================");
    console.log("📊 BACKTEST ENGINE: MULTI-TOUCH CONSOLIDATION SCANNER");
    console.log("=====================================================================");
    
    // 1. Load Symbol Mappings
    if (!fs.existsSync(MAPPING_FILE)) {
        console.error("Missing symbol mappings file.");
        return;
    }
    const mappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    
    // We will backtest on all VIP/Watchlist stocks
    const watchlist = Object.keys(mappings);
    console.log(`Menganalisis ${watchlist.length} kaunter watchlist dari data pasaran...\n`);
    
    let totalTradesSimple = 0;
    let winsSimple = 0;
    let totalProfitSimple = 0;
    
    let totalTradesSOP = 0;
    let winsSOP = 0;
    let totalProfitSOP = 0;
    
    const tradeDetails = [];

    for (const name of watchlist) {
        const symbol = mappings[name];
        try {
            await sleep(100); // Be polite to Yahoo
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
            
            if (!timestamp || timestamp.length < 50) continue;
            
            const validDays = [];
            for (let i = 0; i < timestamp.length; i++) {
                if (close[i] !== null && close[i] !== undefined && low[i] !== null && low[i] !== undefined && high[i] !== null && high[i] !== undefined) {
                    validDays.push({
                        date: new Date(timestamp[i] * 1000).toISOString().split('T')[0],
                        close: close[i],
                        low: low[i],
                        high: high[i]
                    });
                }
            }
            
            if (validDays.length < 30) continue;
            
            // Scan through history
            // We need at least 4 days of history to check consolidation, and 10 days in the future to resolve the trade
            for (let t = 20; t < validDays.length - 10; t++) {
                // Calculate 52W High up to index t
                let high52 = 0;
                const start52W = Math.max(0, t - 250);
                for (let k = start52W; k <= t; k++) {
                    if (validDays[k].high > high52) high52 = validDays[k].high;
                }
                
                const currentPrice = validDays[t].close;
                const pullback = ((high52 - currentPrice) / high52) * 100;
                
                // Consolidation criteria of last 4 days (t-3 to t)
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
                
                // Consolidation trigger
                const isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && (lowTightness <= 4.0 || touchCount >= 2));
                
                if (isConsolidation) {
                    // Avoid overlapping signals for the same stock within 5 days
                    // (if we already entered, we don't open another position immediately)
                    const lastTrade = tradeDetails.filter(tr => tr.name === name).pop();
                    if (lastTrade && (t - lastTrade.tIdx < 5)) continue;
                    
                    const buyPrice = currentPrice;
                    const supportFloor = minLow;
                    const stopLossPrice = supportFloor * 0.98; // 2% buffer below support floor
                    
                    // -------------------------------------------------------------
                    // SIMULATE OUTCOME (Next 10 trading days: t+1 to t+10)
                    // -------------------------------------------------------------
                    let hitTP10 = false;
                    let hitSL = false;
                    let slIdx = -1;
                    let tpIdx = -1;
                    
                    // Look ahead
                    for (let day = 1; day <= 10; day++) {
                        const futureDay = validDays[t + day];
                        
                        // Check if Stop Loss hit first (low drops below stopLossPrice)
                        if (futureDay.low <= stopLossPrice && !hitTP10 && !hitSL) {
                            hitSL = true;
                            slIdx = day;
                        }
                        
                        // Check if Take Profit (+10%) hit (high reaches buyPrice * 1.10)
                        if (futureDay.high >= buyPrice * 1.10 && !hitSL && !hitTP10) {
                            hitTP10 = true;
                            tpIdx = day;
                        }
                    }
                    
                    // 1. SIMPLE EXIT STRATEGY (Exit at day 10 close or SL)
                    let finalReturnSimple = 0;
                    if (hitSL) {
                        finalReturnSimple = ((stopLossPrice - buyPrice) / buyPrice) * 100;
                    } else {
                        const exitPrice = validDays[t + 10].close;
                        finalReturnSimple = ((exitPrice - buyPrice) / buyPrice) * 100;
                    }
                    
                    totalTradesSimple++;
                    if (finalReturnSimple > 0) winsSimple++;
                    totalProfitSimple += finalReturnSimple;
                    
                    // 2. 50-50 PROFIT LOCK SOP (Sell 50% at +10% gain, exit remainder at Day 10 close or entry price if pulled back)
                    let finalReturnSOP = 0;
                    if (hitSL) {
                        // Both halves hit Stop Loss
                        finalReturnSOP = ((stopLossPrice - buyPrice) / buyPrice) * 100;
                    } else if (hitTP10) {
                        // First half sold at +10%
                        const firstHalfReturn = 10.0;
                        
                        // Second half: exit at day 10 close, OR trailing stop at entry price if it dipped below entry after TP
                        let secondHalfPrice = validDays[t + 10].close;
                        for (let day = tpIdx + 1; day <= 10; day++) {
                            if (validDays[t + day].low <= buyPrice) {
                                secondHalfPrice = buyPrice; // Break even on second half
                                break;
                            }
                        }
                        const secondHalfReturn = ((secondHalfPrice - buyPrice) / buyPrice) * 100;
                        finalReturnSOP = (firstHalfReturn + secondHalfReturn) / 2;
                    } else {
                        // No SL and no TP, exit whole position at day 10 close
                        const exitPrice = validDays[t + 10].close;
                        finalReturnSOP = ((exitPrice - buyPrice) / buyPrice) * 100;
                    }
                    
                    totalTradesSOP++;
                    if (finalReturnSOP > 0) winsSOP++;
                    totalProfitSOP += finalReturnSOP;
                    
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
                        returnSimple: finalReturnSimple.toFixed(2),
                        returnSOP: finalReturnSOP.toFixed(2)
                    });
                }
            }
            
        } catch (err) {
            console.error(`Gagal backtest ${name}: ${err.message}`);
        }
    }
    
    // -------------------------------------------------------------
    // PRINT RESULTS
    // -------------------------------------------------------------
    console.log("=====================================================================");
    console.log("📊 KEPUTUSAN BACKTEST (TEMPOH: 1 TAHUN, TIMEFRAME: DAILY)");
    console.log("=====================================================================");
    
    console.log(`\n1. STRATEGI: SIMPLE EXIT (Hold 10 Hari / Cut Loss jika pecah lantai)`);
    console.log(`   + Jumlah Posisi Dibuka : ${totalTradesSimple}`);
    console.log(`   + Win Rate             : ${((winsSimple / totalTradesSimple) * 100).toFixed(1)}% (${winsSimple} trade untung)`);
    console.log(`   + Purata Return / Trade: ${(totalProfitSimple / totalTradesSimple).toFixed(2)}%`);
    
    console.log(`\n2. STRATEGI: 50-50 PROFIT LOCK SOP (Jual 50% di +10%, 50% baki trail ke BE/Day 10)`);
    console.log(`   + Jumlah Posisi Dibuka : ${totalTradesSOP}`);
    console.log(`   + Win Rate             : ${((winsSOP / totalTradesSOP) * 100).toFixed(1)}% (${winsSOP} trade untung)`);
    console.log(`   + Purata Return / Trade: ${(totalProfitSOP / totalTradesSOP).toFixed(2)}%`);
    
    console.log("\n=====================================================================");
    console.log("📋 CONTOH TRADES TERBAIK YANG DIJANA:");
    console.log("=====================================================================");
    const samples = tradeDetails
        .filter(t => parseFloat(t.returnSOP) > 5)
        .slice(0, 10);
    
    samples.forEach(t => {
        console.log(`   📅 ${t.date} | 📈 ${t.name} | Beli: RM ${t.buyPrice.toFixed(3)} | Pullback: ${t.pullback}% | Tightness: ${t.closeTightness}% | Touches: ${t.touchCount}x | Return SOP: +${t.returnSOP}%`);
    });
}

runBacktest().catch(console.error);
