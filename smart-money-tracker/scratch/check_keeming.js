const axios = require('axios');

async function getKeemingHistory() {
    const ticker = '0392.KL';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=20d`;
    try {
        const res = await axios.get(url);
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp;
        const indicators = result.indicators.quote[0];
        
        console.log(`\n📈 PERGERAKAN HARGA KEEMING (0392.KL):`);
        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
            const open = indicators.open[i];
            const high = indicators.high[i];
            const low = indicators.low[i];
            const close = indicators.close[i];
            const volume = indicators.volume[i];
            
            if (open !== null && close !== null) {
                console.log(`  📅 ${date} | Open: RM ${open.toFixed(3)} | High: RM ${high.toFixed(3)} | Low: RM ${low.toFixed(3)} | Close: RM ${close.toFixed(3)} | Vol: ${volume}`);
            }
        }
    } catch (e) {
        console.log(`  ❌ Gagal memuat data bagi KEEMING (0392.KL): ${e.message}`);
    }
}

getKeemingHistory();
