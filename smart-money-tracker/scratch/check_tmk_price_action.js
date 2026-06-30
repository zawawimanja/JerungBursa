const axios = require('axios');

async function checkTmkPriceAction() {
    const ticker = '5330.KL';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=90d`;
    try {
        const res = await axios.get(url);
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp || [];
        const indicators = result.indicators.quote[0];
        
        console.log(`Company Ticker: ${result.meta.symbol} | Days: ${timestamps.length}`);
        
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
        
        console.log(`=== HARI TERAKHIR TMK ===`);
        const lastDays = prices.slice(-15);
        lastDays.forEach(day => {
            console.log(`Date: ${day.date} | Open: ${day.open.toFixed(3)} | Close: ${day.close.toFixed(3)} | Low: ${day.low.toFixed(3)} | High: ${day.high.toFixed(3)} | Volume: ${day.volume.toLocaleString()}`);
        });
    } catch (e) {
        console.error(e);
    }
}

checkTmkPriceAction();
