const axios = require('axios');
const symbolMappings = require('../symbol_mappings.json');

const symbols = ['SAM', 'CBHB', 'LWSABAH', 'OGX', 'SDCG'];

async function run() {
    const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
    for (const sym of symbols) {
        const ticker = symbolMappings[sym];
        if (!ticker) continue;
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=15d`;
            const res = await axios.get(url, { headers: HEADERS });
            const result = res.data.chart.result[0];
            const timestamp = result.timestamp || [];
            const quote = result.indicators.quote[0];
            const close = quote.close || [];
            const low = quote.low || [];
            const high = quote.high || [];
            const open = quote.open || [];
            const volume = quote.volume || [];

            console.log(`\n=========================================`);
            console.log(`📈 DATA 10 HARI TERAKHIR UNTUK ${sym} (${ticker})`);
            console.log(`=========================================`);
            console.log("TARIKH     | OPEN  | HIGH  | LOW   | CLOSE | VOL (M) | RANGE");
            console.log("-".repeat(60));
            
            const days = [];
            for (let i = 0; i < timestamp.length; i++) {
                if (close[i] !== null && close[i] !== undefined) {
                    days.push({
                        date: new Date(timestamp[i] * 1000).toISOString().split('T')[0],
                        open: open[i],
                        high: high[i],
                        low: low[i],
                        close: close[i],
                        volume: volume[i] || 0
                    });
                }
            }

            const last10 = days.slice(-10);
            last10.forEach(d => {
                const rng = d.high - d.low;
                console.log(`${d.date} | ${d.open.toFixed(3)} | ${d.high.toFixed(3)} | ${d.low.toFixed(3)} | ${d.close.toFixed(3)} | ${(d.volume/1e6).toFixed(2)}M | ${rng.toFixed(3)}`);
            });
        } catch (e) {
            console.error(`Failed to fetch for ${sym}: ${e.message}`);
        }
    }
}

run();
