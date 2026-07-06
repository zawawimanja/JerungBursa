const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

async function getYahooData(symbol) {
    try {
        console.log(`\n=== FETCHING YAHOO DATA FOR ${symbol} ===`);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=30d`;
        const res = await axios.get(url, { headers: HEADERS });
        const result = res.data.chart.result[0];
        const timestamp = result.timestamp;
        const quote = result.indicators.quote[0];
        const close = quote.close;
        const low = quote.low;
        const high = quote.high;
        const open = quote.open;
        
        const last10 = [];
        for (let i = timestamp.length - 1; i >= Math.max(0, timestamp.length - 10); i--) {
            const date = new Date(timestamp[i] * 1000).toISOString().split('T')[0];
            last10.push({
                date,
                open: open ? open[i] : null,
                high: high ? high[i] : null,
                low: low ? low[i] : null,
                close: close ? close[i] : null
            });
        }
        
        console.log('Last 10 Days:');
        console.table(last10);
    } catch (e) {
        console.error(`Error fetching ${symbol}:`, e.message);
    }
}

async function main() {
    await getYahooData('0459.KL'); // SUM
    await getYahooData('0457.KL'); // PENTECH
}

main();
