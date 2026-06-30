const axios = require('axios');

async function checkKeemingFullHistory() {
    const ticker = '0392.KL';
    // Load last 90 days of history
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
        
        console.log(`🔍 MEMULAKAN SIMULASI SETUP GABUNGAN EMAS BAGI KEEMING (${prices.length} HARI TRADING)...`);
        
        let triggers = [];
        
        // Loop from index 20 to latest to have enough lookback data for 52W High and 10-day floor
        for (let idx = 20; idx < prices.length; idx++) {
            const currentDay = prices[idx];
            const currentPrice = currentDay.close;
            
            // 52W High up to this day
            const historyUpToToday = prices.slice(0, idx + 1);
            let high52 = 0;
            historyUpToToday.forEach(d => {
                if (d.high > high52) high52 = d.high;
            });
            
            // Last 4 days for closeness/tightness
            const last4Days = prices.slice(idx - 3, idx + 1);
            const closes = last4Days.map(d => d.close);
            const maxClose = Math.max(...closes);
            const minClose = Math.min(...closes);
            const closeTightness = ((maxClose - minClose) / minClose) * 100;
            
            // 10-day lookback floor (for touchCount and floorLow)
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
            
            const pullback = ((high52 - currentPrice) / high52) * 100;
            
            // Golden Setup Criteria:
            // 1. Pullback <= 15.0%
            // 2. closeTightness <= 5.5%
            // 3. touchCount >= 3
            const isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && touchCount >= 3);
            
            if (isConsolidation) {
                triggers.push({
                    date: currentDay.date,
                    price: currentPrice,
                    high52,
                    pullback: pullback.toFixed(2),
                    closeTightness: closeTightness.toFixed(2),
                    touchCount,
                    floorLow: minLow
                });
            }
        }
        
        if (triggers.length > 0) {
            console.log(`\n🎉 KEEMING PERNAH MASUK SETUP KITA PADA TARIKH BERIKUT:`);
            triggers.forEach(t => {
                console.log(`  📅 ${t.date} | Close: RM ${t.price.toFixed(3)} | 52W High: RM ${t.high52.toFixed(3)} | Pullback: ${t.pullback}% | CloseTight: ${t.closeTightness}% | TouchCount: ${t.touchCount}x | Lantai: RM ${t.floorLow.toFixed(3)}`);
            });
        } else {
            console.log(`\n❌ KEEMING tidak pernah masuk Setup kita dalam 90 hari lepas.`);
        }
        
    } catch (e) {
        console.error(`❌ Gagal memproses KEEMING: ${e.message}`);
    }
}

checkKeemingFullHistory();
