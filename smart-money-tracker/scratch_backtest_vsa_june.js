const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MAPPING_FILE = path.join(__dirname, 'symbol_mappings.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runVSABacktestJune() {
    console.log("=====================================================================");
    console.log("📊 VSA BACKTEST: 1 JUNE 2026 - TODAY (23 JUNE 2026) | PASARAN LUAS");
    console.log("=====================================================================");
    
    if (!fs.existsSync(MAPPING_FILE)) {
        console.error("Missing mappings file.");
        return;
    }
    const mappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    const allSymbols = Object.keys(mappings);
    
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
            
            // Scan history starting from 15th June 2026
            for (let t = 5; t < validDays.length - 1; t++) { // allow active trades up to the last candle
                const tradeDate = validDays[t].date;
                if (tradeDate < '2026-06-15') continue; // Date filter for 15 June onwards
                
                // Calculate average volume using available history
                const mainLookback = Math.min(20, t);
                let sumVol = 0;
                for (let k = t - mainLookback; k < t; k++) {
                    sumVol += validDays[k].volume;
                }
                const avgVol = sumVol / mainLookback;
                
                // VSA Volume Filter:
                // We check if there was a volume spike (>1.5x average OR turnover > RM 500k) on day t OR within the last 4 days (breakout phase)
                let recentVolumeSpike = false;
                for (let offset = 0; offset <= 4; offset++) {
                    const checkIdx = t - offset;
                    if (checkIdx < 1) continue; // need at least 1 day of history to check volume spike
                    
                    // calculate average for that checkIdx
                    const subLookback = Math.min(20, checkIdx);
                    let subSumVol = 0;
                    for (let k = checkIdx - subLookback; k < checkIdx; k++) {
                        subSumVol += validDays[k].volume;
                    }
                    const subAvgVol = subSumVol / subLookback;
                    
                    const isSpike = validDays[checkIdx].volume > 1.5 * subAvgVol;
                    const checkTurnover = validDays[checkIdx].close * validDays[checkIdx].volume;
                    const isHighLiquidity = checkTurnover >= 500000;
                    
                    if (isSpike || isHighLiquidity) {
                        recentVolumeSpike = true;
                        break;
                    }
                }
                
                if (!recentVolumeSpike) continue;
                
                // Multi-Touch Consolidation check
                let high52 = 0;
                const start52W = Math.max(0, t - 250);
                for (let k = start52W; k <= t; k++) {
                    if (validDays[k].high > high52) high52 = validDays[k].high;
                }
                
                const currentPrice = validDays[t].close;
                if (currentPrice > 3.0) continue; // Target stocks under RM 3.00 only
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
                
                // Refined consolidation logic:
                // 1. Classic 4-day tight consolidation
                const classicConsol = (pullback <= 15.0 && closeTightness <= 5.5 && (lowTightness <= 4.0 || touchCount >= 2));
                
                // 2. High-momentum 2-day flag (PENTECH setup: tight closes and lows on last 2 days)
                const closeTightness2d = (Math.max(validDays[t].close, validDays[t-1].close) - Math.min(validDays[t].close, validDays[t-1].close)) / Math.min(validDays[t].close, validDays[t-1].close) * 100;
                const lowTightness2d = (Math.max(validDays[t].low, validDays[t-1].low) - Math.min(validDays[t].low, validDays[t-1].low)) / Math.min(validDays[t].low, validDays[t-1].low) * 100;
                const flagConsol = (pullback <= 15.0 && closeTightness2d <= 3.0 && lowTightness2d <= 3.5);
                
                const isConsolidation = classicConsol || flagConsol;
                
                if (isConsolidation) {
                    const lastTrade = tradeDetails.filter(tr => tr.name === name).pop();
                    if (lastTrade && (t - lastTrade.tIdx < 5)) continue;
                    
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
                        const exitDay = validDays[t + 10] || validDays[validDays.length - 1];
                        let secondHalfPrice = exitDay.close;
                        
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
                        const exitDay = validDays[t + 10] || validDays[validDays.length - 1];
                        const exitPrice = exitDay.close;
                        finalReturnSOP = ((exitPrice - buyPrice) / buyPrice) * 100;
                    }
                    
                    if (finalReturnSOP < -15 || finalReturnSOP > 40) continue;
                    
                    totalTrades++;
                    if (finalReturnSOP > 0) wins++;
                    totalProfit += finalReturnSOP;
                    
                    tradeDetails.push({
                        name,
                        date: tradeDate,
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
    
    console.log(`\nJumlah Trade Dikesan Sejak 1 Jun (VSA + Multi-Touch): ${totalTrades}`);
    console.log("=====================================================================");
    console.log(`   + Win Rate             : ${totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0}% (${wins} trade untung)`);
    console.log(`   + Purata Return / Trade: ${totalTrades > 0 ? (totalProfit / totalTrades).toFixed(2) : 0}%`);
    console.log(`   + JUMLAH KESELURUHAN PROFIT: ${totalProfit.toFixed(2)}%`);
    console.log("=====================================================================");
    
    console.log("\n📋 SENARAI SEMUA TRADES GABUNGAN (1 JUN - SEKARANG):");
    console.log("=====================================================================");
    tradeDetails
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(t => {
            console.log(`   📅 ${t.date} | 📈 ${t.name} | Beli: RM ${t.buyPrice.toFixed(3)} | Pullback: ${t.pullback}% | Return: ${t.returnSOP > 0 ? '+' : ''}${t.returnSOP.toFixed(2)}% | TP10 Hit: ${t.hitTP10 ? 'YA' : 'TIDAK'} | SL Hit: ${t.hitSL ? 'YA' : 'TIDAK'}`);
        });
}

runVSABacktestJune().catch(console.error);
