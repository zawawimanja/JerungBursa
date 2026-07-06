const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

async function checkTrend(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
        const res = await axios.get(url, { headers: HEADERS });
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close.filter(c => c !== null && c !== undefined);
        
        const currentPrice = closes[closes.length - 1];
        
        // Calculate SMA 20
        const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        // Calculate SMA 50
        const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
        
        console.log(`\n=== TREND CHECK FOR ${symbol} ===`);
        console.log(`Current Price: RM ${currentPrice.toFixed(3)}`);
        console.log(`SMA 20:        RM ${sma20.toFixed(3)} (Price vs SMA20: ${(((currentPrice - sma20)/sma20)*100).toFixed(2)}%)`);
        console.log(`SMA 50:        RM ${sma50.toFixed(3)} (Price vs SMA50: ${(((currentPrice - sma50)/sma50)*100).toFixed(2)}%)`);
        console.log(`Is Price < SMA 20? ${currentPrice < sma20}`);
        console.log(`Is Price < SMA 50? ${currentPrice < sma50}`);
        console.log(`Is SMA 20 < SMA 50? ${sma20 < sma50} (Downtrend crossover)`);
    } catch (e) {
        console.error(e.message);
    }
}

async function main() {
    await checkTrend('7113.KL'); // TOPGLOV
}

main();
