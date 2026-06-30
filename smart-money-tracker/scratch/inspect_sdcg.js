const axios = require('axios');

async function run() {
    const symbol = '0248.KL'; // YEWLEE
    const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
    const res = await axios.get(url, { headers: HEADERS });
    const result = res.data.chart.result[0];
    const timestamp = result.timestamp || [];
    const quote = result.indicators.quote[0];
    const close = quote.close || [];
    const low = quote.low || [];
    const high = quote.high || [];
    const open = quote.open || [];
    const volume = quote.volume || [];

    const validDays = [];
    for (let i = 0; i < timestamp.length; i++) {
        if (close[i] !== null && close[i] !== undefined && 
            low[i] !== null && low[i] !== undefined && 
            high[i] !== null && high[i] !== undefined &&
            open[i] !== null && open[i] !== undefined) {
            validDays.push({
                close: close[i],
                low: low[i],
                high: high[i],
                open: open[i],
                volume: volume[i] || 0
            });
        }
    }

    const last20 = validDays.slice(-20);
    console.log(`Total valid days: ${validDays.length}`);
    console.log(`Last 20 days data for SDCG:`);
    let sumTurnover = 0;
    let flatDays = 0;
    let smallRangeDays = 0;

    last20.forEach((d, idx) => {
        const turnover = d.close * d.volume;
        sumTurnover += turnover;
        const isFlat = d.high === d.low;
        if (isFlat) flatDays++;
        const range = d.high - d.low;
        const isSmallRange = range <= 0.0051;
        if (isSmallRange) smallRangeDays++;

        console.log(`[Day ${idx+1}] Close: ${d.close}, Low: ${d.low}, High: ${d.high}, Vol: ${d.volume}, Turnover: RM ${turnover.toFixed(2)}, Range: ${range.toFixed(4)} (Flat: ${isFlat}, Small: ${isSmallRange})`);
    });

    const avgTurnover = sumTurnover / last20.length;
    const flatPct = (flatDays / last20.length) * 100;
    const smallRangePct = (smallRangeDays / last20.length) * 100;

    console.log(`\nSummary:`);
    console.log(`- Avg Turnover: RM ${avgTurnover.toFixed(2)}`);
    console.log(`- Flat Days: ${flatDays}/20 (${flatPct.toFixed(1)}%)`);
    console.log(`- Small Range Days: ${smallRangeDays}/20 (${smallRangePct.toFixed(1)}%)`);
    console.log(`- isCombStock: ${(avgTurnover < 250000) || (flatPct >= 10.0) || (smallRangePct >= 20.0)}`);
}

run();
