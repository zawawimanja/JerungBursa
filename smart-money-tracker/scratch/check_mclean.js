const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

async function checkMcLean() {
    const symbol = '0167.KL';
    try {
        console.log(`Fetching 2-year daily history for ${symbol}...`);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y`;
        const res = await axios.get(url, { headers: HEADERS });
        
        if (!res.data || !res.data.chart || !res.data.chart.result || !res.data.chart.result[0]) {
            console.error('No data returned from Yahoo Finance');
            return;
        }

        const result = res.data.chart.result[0];
        const timestamp = result.timestamp;
        const quote = result.indicators.quote[0];
        const close = quote.close;
        const high = quote.high;
        const low = quote.low;
        const open = quote.open;
        const volume = quote.volume;

        const history = [];
        for (let i = 0; i < timestamp.length; i++) {
            if (timestamp[i] && close[i] !== null && high[i] !== null && volume[i] !== null) {
                const date = new Date(timestamp[i] * 1000).toISOString().split('T')[0];
                history.push({
                    date,
                    open: open[i],
                    high: high[i],
                    low: low[i],
                    close: close[i],
                    volume: volume[i],
                    turnover: close[i] * volume[i]
                });
            }
        }

        console.log(`Total history records found: ${history.length}`);
        
        // Print the last 10 days of trading
        console.log('\n--- LAST 10 TRADING DAYS ---');
        const last10 = history.slice(-10);
        last10.forEach(day => {
            console.log(`${day.date} | Open: ${day.open.toFixed(3)} | High: ${day.high.toFixed(3)} | Low: ${day.low.toFixed(3)} | Close: ${day.close.toFixed(3)} | Vol: ${(day.volume / 1e6).toFixed(2)}M | Turnover: RM ${(day.turnover / 1e3).toFixed(1)}k`);
        });

        // Let's analyze high52 or ATH on Friday, Jun 26 and Monday, Jun 29
        // We will loop through the dates and see if the daily high was a new multi-month or multi-year high relative to preceding period.
        console.log('\n--- DETAILED ATH / 52W HIGH ANALYSIS ---');
        for (let i = 100; i < history.length; i++) {
            const currentDay = history[i];
            if (currentDay.date === '2026-06-25' || currentDay.date === '2026-06-26' || currentDay.date === '2026-06-29' || currentDay.date === '2026-06-30') {
                // calculate 52w high up to the previous day
                // 52 weeks is about 250 trading days
                const startIdx = Math.max(0, i - 250);
                const precedingPeriod = history.slice(startIdx, i);
                const highestHighPreceding = Math.max(...precedingPeriod.map(d => d.high));
                const highestClosePreceding = Math.max(...precedingPeriod.map(d => d.close));
                
                const isNew52WHighPrice = currentDay.high >= highestHighPreceding;
                const isNew52WClosePrice = currentDay.close >= highestClosePreceding;
                
                console.log(`\nDate: ${currentDay.date}`);
                console.log(`  Today's Close: ${currentDay.close.toFixed(3)} | High: ${currentDay.high.toFixed(3)}`);
                console.log(`  Preceding 52W High (Intraday): ${highestHighPreceding.toFixed(3)}`);
                console.log(`  Preceding 52W High (Closing):  ${highestClosePreceding.toFixed(3)}`);
                console.log(`  Is Intraday 52W High? ${isNew52WHighPrice ? '🟢 YES' : '❌ NO'}`);
                console.log(`  Is Closing 52W High?  ${isNew52WClosePrice ? '🟢 YES' : '❌ NO'}`);
                console.log(`  Volume: ${(currentDay.volume / 1e6).toFixed(2)}M | Turnover: RM ${(currentDay.turnover / 1e3).toFixed(1)}k`);
            }
        }
        
    } catch (error) {
        console.error('Error fetching data:', error.message);
    }
}

checkMcLean();
