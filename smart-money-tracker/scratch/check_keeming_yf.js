const axios = require('axios');

async function main() {
    try {
        const res = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/0392.KL?interval=1d&range=1mo');
        const chart = res.data.chart.result[0];
        const timestamps = chart.timestamp;
        const indicators = chart.indicators.quote[0];
        
        console.log('Date | Low | High | Close | Volume');
        console.log('------------------------------------------------');
        
        for (let i = timestamps.length - 15; i < timestamps.length; i++) {
            if (i < 0) continue;
            const date = new Date(timestamps[i] * 1000).toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }).split(',')[0];
            const low = indicators.low[i];
            const high = indicators.high[i];
            const close = indicators.close[i];
            const volume = indicators.volume[i];
            console.log(`${date} | RM ${low ? low.toFixed(3) : 'N/A'} | RM ${high ? high.toFixed(3) : 'N/A'} | RM ${close ? close.toFixed(3) : 'N/A'} | ${volume}`);
        }
    } catch (e) {
        console.error('Error fetching data:', e.message);
    }
}

main();
