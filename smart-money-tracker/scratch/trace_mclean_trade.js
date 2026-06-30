const axios = require('axios');

async function traceMcleanTrade() {
    const ticker = '0167.KL';
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
        
        const entryIdx = prices.findIndex(p => p.date === '2026-05-27');
        if (entryIdx === -1) {
            console.log("Tarikh tidak dijumpai.");
            return;
        }
        
        console.log(`=== JEJAKAN TRADE MCLEAN (SELEPAS ENTRY 27 MEI) ===`);
        console.log(`Entry Date: 2026-05-27 | Price: RM 0.580 | Floor: RM 0.570 | Stop Loss (3%): RM 0.553`);
        console.log('--------------------------------------------------');
        
        for (let idx = entryIdx - 3; idx < Math.min(entryIdx + 12, prices.length); idx++) {
            const day = prices[idx];
            const hitSL = day.low <= 0.553;
            console.log(`Date: ${day.date} | Open: ${day.open.toFixed(3)} | Close: ${day.close.toFixed(3)} | Low: ${day.low.toFixed(3)} | High: ${day.high.toFixed(3)} | Hit SL? ${hitSL ? '🚨 YES' : 'NO'}`);
        }
    } catch (e) {
        console.error(e);
    }
}

traceMcleanTrade();
