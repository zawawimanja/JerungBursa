const axios = require('axios');

async function testMmcsDynamicSimulation() {
    const ticker = '0456.KL';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=90d`;
    try {
        const res = await axios.get(url);
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp;
        const indicators = result.indicators.quote[0];
        
        const prices = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (indicators.open[i] !== null && indicators.close[i] !== null) {
                prices.push({
                    date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                    open: indicators.open[i],
                    high: indicators.high[i],
                    low: indicators.low[i],
                    close: indicators.close[i],
                    volume: indicators.volume[i]
                });
            }
        }
        
        console.log(`=== SIMULASI MMCS DENGAN DYNAMIC LOOKBACK (19 - 30 JUN 2026) ===`);
        for (let idx = 5; idx < prices.length; idx++) {
            const currentDay = prices[idx];
            if (currentDay.date >= '2026-06-19' && currentDay.date <= '2026-06-30') {
                const historyUpToToday = prices.slice(0, idx + 1);
                let high52 = 0;
                historyUpToToday.forEach(d => {
                    if (d.high > high52) high52 = d.high;
                });
                
                const last4Days = prices.slice(idx - 3, idx + 1);
                const closes = last4Days.map(d => d.close);
                const maxClose = Math.max(...closes);
                const minClose = Math.min(...closes);
                const closeTightness = ((maxClose - minClose) / minClose) * 100;
                
                // DYNAMIC LOOKBACK: 5 days for young IPOs (< 25 days history)
                const lookbackDays = (historyUpToToday.length < 25) 
                    ? Math.min(5, historyUpToToday.length) 
                    : Math.min(10, historyUpToToday.length);
                const dailyLookback = historyUpToToday.slice(-lookbackDays);
                const dailyLows = dailyLookback.map(d => d.low);
                const minLow = Math.min(...dailyLows);
                
                let touchCount = 0;
                dailyLookback.forEach(d => {
                    const diffPct = ((d.low - minLow) / minLow) * 100;
                    if (diffPct <= 2.0) {
                        touchCount++;
                    }
                });
                
                const pullback = ((high52 - currentDay.close) / high52) * 100;
                const distToFloor = ((currentDay.close - minLow) / minLow) * 100;
                
                const isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && touchCount >= 3 && distToFloor <= 3.0);
                
                console.log(`Date: ${currentDay.date} | Close: RM ${currentDay.close.toFixed(3)} | Low: RM ${currentDay.low.toFixed(3)}`);
                console.log(`  52W High: RM ${high52.toFixed(3)} | Pullback: ${pullback.toFixed(2)}%`);
                console.log(`  CloseTightness: ${closeTightness.toFixed(2)}% | Lookback Window: ${lookbackDays} days`);
                console.log(`  Lantai: RM ${minLow.toFixed(3)} | Jarak ke Lantai: ${distToFloor.toFixed(2)}% | Sentuhan: ${touchCount}x`);
                console.log(`  Adakah Golden Setup? ${isConsolidation ? '🟢 YA (Entry Terbaik!)' : '❌ TIDAK'}`);
                console.log('--------------------------------------------------');
            }
        }
    } catch (e) {
        console.error(e);
    }
}

testMmcsDynamicSimulation();
