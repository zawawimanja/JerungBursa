const axios = require('axios');

async function checkAdnexFullHistory() {
    const ticker = '0396.KL';
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
        
        console.log(`🔍 MEMULAKAN SIMULASI SETUP GABUNGAN EMAS BAGI ADNEX (${prices.length} HARI TRADING)...`);
        
        let triggers = [];
        
        for (let idx = 20; idx < prices.length; idx++) {
            const currentDay = prices[idx];
            const currentPrice = currentDay.close;
            
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
            
            const pullback = ((high52 - currentPrice) / high52) * 100;
            const distToFloor = ((currentPrice - minLow) / minLow) * 100;
            
            const isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && touchCount >= 3 && distToFloor <= 3.0);
            
            if (isConsolidation) {
                triggers.push({
                    date: currentDay.date,
                    price: currentPrice,
                    high52,
                    pullback: pullback.toFixed(2),
                    closeTightness: closeTightness.toFixed(2),
                    touchCount,
                    floorLow: minLow,
                    distToFloor: distToFloor.toFixed(2)
                });
            }
        }
        
        if (triggers.length > 0) {
            console.log(`\n🎉 ADNEX PERNAH MASUK SETUP KITA PADA TARIKH BERIKUT:`);
            triggers.forEach(t => {
                console.log(`  📅 ${t.date} | Close: RM ${t.price.toFixed(3)} | 52W High: RM ${t.high52.toFixed(3)} | Pullback: ${t.pullback}% | CloseTight: ${t.closeTightness}% | TouchCount: ${t.touchCount}x | Lantai: RM ${t.floorLow.toFixed(3)} | Jarak: ${t.distToFloor}%`);
            });
        } else {
            console.log(`\n❌ ADNEX tidak pernah masuk Setup kita dalam 90 hari lepas.`);
        }
        
    } catch (e) {
        console.error(`❌ Gagal memproses ADNEX: ${e.message}`);
    }
}

checkAdnexFullHistory();
