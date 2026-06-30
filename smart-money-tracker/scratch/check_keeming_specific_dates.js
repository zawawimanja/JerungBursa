const axios = require('axios');

async function checkKeemingSpecificDates() {
    const ticker = '0392.KL';
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
        
        console.log(`=== DATA HARIAN KEEMING (15 JUN - 19 JUN 2026) ===`);
        for (let idx = 20; idx < prices.length; idx++) {
            const currentDay = prices[idx];
            if (currentDay.date >= '2026-06-15' && currentDay.date <= '2026-06-19') {
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
                
                const lookbackDays = Math.min(10, idx + 1);
                const dailyLookback = prices.slice(idx - lookbackDays + 1, idx + 1);
                const dailyLows = dailyLookback.map(d => d.low);
                const minLow = Math.min(...dailyLows);
                const maxLow = Math.max(...dailyLows);
                const lowTightness = ((maxLow - minLow) / minLow) * 100;
                
                let touchCount = 0;
                dailyLookback.forEach(d => {
                    const diffPct = ((d.low - minLow) / minLow) * 100;
                    if (diffPct <= 2.0) {
                        touchCount++;
                    }
                });
                
                const pullback = ((high52 - currentDay.close) / high52) * 100;
                const isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && touchCount >= 3);
                
                console.log(`Date: ${currentDay.date}`);
                console.log(`  Close: RM ${currentDay.close.toFixed(3)} | Low: RM ${currentDay.low.toFixed(3)} | High: RM ${currentDay.high.toFixed(3)}`);
                console.log(`  52W High: RM ${high52.toFixed(3)} | Pullback: ${pullback.toFixed(2)}%`);
                console.log(`  CloseTightness: ${closeTightness.toFixed(2)}% (SOP <= 5.5%)`);
                console.log(`  TouchCount: ${touchCount}x (SOP >= 3x) | Lantai (10d Min Low): RM ${minLow.toFixed(3)}`);
                console.log(`  Qualifies: ${isConsolidation ? '🟢 YES' : '❌ NO'}`);
                console.log('--------------------------------------------------');
            }
        }
    } catch (e) {
        console.error(e);
    }
}

checkKeemingSpecificDates();
