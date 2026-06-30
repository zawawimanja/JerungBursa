const axios = require('axios');

async function printMmcsPrices() {
    const ticker = '0456.KL';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=90d`;
    try {
        const res = await axios.get(url);
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp;
        const indicators = result.indicators.quote[0];
        
        console.log(`=== MMCS (0456.KL) PRICE DATA ===`);
        for (let i = 0; i < timestamps.length; i++) {
            if (indicators.open[i] !== null && indicators.close[i] !== null) {
                const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                console.log(`Date: ${date} | Open: ${indicators.open[i].toFixed(3)} | High: ${indicators.high[i].toFixed(3)} | Low: ${indicators.low[i].toFixed(3)} | Close: ${indicators.close[i].toFixed(3)} | Volume: ${indicators.volume[i]}`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

printMmcsPrices();
