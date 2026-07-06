const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

async function checkEca() {
    const symbol = '0267.KL';
    console.log(`Fetching 1y chart for ${symbol}...`);
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
        const res = await axios.get(url, { headers: HEADERS });
        if (!res.data || !res.data.chart || !res.data.chart.result || !res.data.chart.result[0]) {
            console.error("No data returned");
            return;
        }
        const result = res.data.chart.result[0];
        const timestamp = result.timestamp || [];
        const quote = result.indicators.quote[0];
        const close = quote.close || [];
        
        const validCloses = close.filter(c => c !== null && c !== undefined);
        console.log(`Total valid trading days: ${validCloses.length}`);
        
        if (validCloses.length > 0) {
            const currentPrice = validCloses[validCloses.length - 1];
            const sma50 = validCloses.length >= 50
                ? validCloses.slice(-50).reduce((a, b) => a + b, 0) / 50
                : (validCloses.reduce((a, b) => a + b, 0) / validCloses.length);
            const sma200 = validCloses.length >= 200
                ? validCloses.slice(-200).reduce((a, b) => a + b, 0) / 200
                : (validCloses.reduce((a, b) => a + b, 0) / validCloses.length);
            
            console.log(`Current Price: RM ${currentPrice.toFixed(3)}`);
            console.log(`SMA50: RM ${sma50.toFixed(3)}`);
            console.log(`SMA200: RM ${sma200.toFixed(3)}`);
            console.log(`Price >= SMA50: ${currentPrice >= sma50}`);
            console.log(`Price >= SMA200: ${currentPrice >= sma200}`);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkEca();
