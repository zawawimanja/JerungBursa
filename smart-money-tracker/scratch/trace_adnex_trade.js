const axios = require('axios');

async function traceAdnexTrade() {
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
        
        const entryIdx = prices.findIndex(p => p.date === '2026-05-20');
        if (entryIdx === -1) {
            console.log("Tarikh 20 Mei tidak dijumpai.");
            return;
        }
        
        console.log(`=== JEJAKAN TRADE ADNEX (SELEPAS ENTRY 20 MEI) ===`);
        console.log(`Entry Date: 2026-05-20 | Price: RM 0.290 | Floor: RM 0.290 | Stop Loss (3%): RM 0.281`);
        console.log('--------------------------------------------------');
        
        for (let idx = entryIdx + 1; idx < Math.min(entryIdx + 20, prices.length); idx++) {
            const day = prices[idx];
            const hitSL = day.low <= 0.281;
            console.log(`Date: ${day.date} | Open: ${day.open.toFixed(3)} | Close: ${day.close.toFixed(3)} | Low: ${day.low.toFixed(3)} | High: ${day.high.toFixed(3)} | Hit SL? ${hitSL ? '🚨 YES' : 'NO'}`);
        }
    } catch (e) {
        console.error(e);
    }
}

traceAdnexTrade();
