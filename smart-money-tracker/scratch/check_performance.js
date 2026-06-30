const axios = require('axios');
const symbolMappings = require('../symbol_mappings.json');

const symbols = ['BETA', 'SDCG', 'SSF', 'ECOMATE', 'WINSTAR'];

async function getHistory(symbol) {
    const ticker = symbolMappings[symbol];
    if (!ticker) {
        console.log(`  ❌ Tiada pemetaan symbol untuk ${symbol}`);
        return;
    }
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10d`;
    try {
        const res = await axios.get(url);
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp;
        const indicators = result.indicators.quote[0];
        
        console.log(`\n📈 PERGERAKAN HARGA ${symbol} (${ticker}):`);
        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
            if (date === '2026-06-25' || date === '2026-06-26' || date === '2026-06-29' || date === '2026-06-30') {
                const open = indicators.open[i];
                const high = indicators.high[i];
                const low = indicators.low[i];
                const close = indicators.close[i];
                
                if (open !== null && close !== null) {
                    console.log(`  📅 ${date} | Open: RM ${open.toFixed(3)} | High: RM ${high.toFixed(3)} | Low: RM ${low.toFixed(3)} | Close: RM ${close.toFixed(3)}`);
                }
            }
        }
    } catch (e) {
        console.log(`  ❌ Gagal memuat data bagi ${symbol} (${ticker}): ${e.message}`);
    }
}

async function run() {
    for (const sym of symbols) {
        await getHistory(sym);
    }
}

run();
