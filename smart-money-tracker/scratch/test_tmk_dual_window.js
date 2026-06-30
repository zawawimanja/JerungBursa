const axios = require('axios');

async function testTmkDualWindow() {
    const ticker = '5330.KL';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=90d`;
    try {
        const res = await axios.get(url);
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp || [];
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
        
        console.log(`=== SIMULASI TMK DENGAN DUAL-WINDOW FLOOR (20 APR - 22 MEI 2026) ===`);
        for (let idx = 20; idx < prices.length; idx++) {
            const currentDay = prices[idx];
            if (currentDay.date >= '2026-04-20' && currentDay.date <= '2026-05-22') {
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
                
                // 10-day floor calculation
                const lookback10 = Math.min(10, historyUpToToday.length);
                const dailyLookback10 = historyUpToToday.slice(-lookback10);
                const lows10 = dailyLookback10.map(d => d.low);
                const floor10 = Math.min(...lows10);
                const dist10 = ((currentDay.close - floor10) / floor10) * 100;
                let touch10 = 0;
                dailyLookback10.forEach(d => {
                    if (((d.low - floor10) / floor10) * 100 <= 2.0) touch10++;
                });
                
                // 5-day floor calculation
                const lookback5 = Math.min(5, historyUpToToday.length);
                const dailyLookback5 = historyUpToToday.slice(-lookback5);
                const lows5 = dailyLookback5.map(d => d.low);
                const floor5 = Math.min(...lows5);
                const dist5 = ((currentDay.close - floor5) / floor5) * 100;
                
                // Touch count for floor5 in the last 10 days
                let touch5 = 0;
                dailyLookback10.forEach(d => {
                    if (Math.abs(((d.low - floor5) / floor5) * 100) <= 2.0) touch5++;
                });
                
                // Pullback
                const pullback = ((high52 - currentDay.close) / high52) * 100;
                
                // Evaluation
                const isConsolidation10 = (pullback <= 15.0 && closeTightness <= 5.5 && touch10 >= 3 && dist10 <= 3.0);
                const isConsolidation5 = (pullback <= 15.0 && closeTightness <= 5.5 && touch5 >= 3 && dist5 <= 3.0);
                const finalQualify = isConsolidation10 || isConsolidation5;
                
                const selectedFloor = isConsolidation10 ? floor10 : (isConsolidation5 ? floor5 : floor10);
                const selectedDist = isConsolidation10 ? dist10 : (isConsolidation5 ? dist5 : dist10);
                const selectedTouch = isConsolidation10 ? touch10 : (isConsolidation5 ? touch5 : touch10);
                const selectedWindow = isConsolidation10 ? "10-day" : (isConsolidation5 ? "5-day" : "none");
                
                if (finalQualify) {
                    console.log(`🟢 TRIGGERED: ${currentDay.date} | Close: RM ${currentDay.close.toFixed(3)} | 52W High: RM ${high52.toFixed(3)} | Pullback: ${pullback.toFixed(2)}%`);
                    console.log(`   Selected Window: ${selectedWindow} | Floor: RM ${selectedFloor.toFixed(3)} | Dist: ${selectedDist.toFixed(2)}% | TouchCount: ${selectedTouch}x | CloseTight: ${closeTightness.toFixed(2)}%`);
                    console.log('--------------------------------------------------');
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

testTmkDualWindow();
