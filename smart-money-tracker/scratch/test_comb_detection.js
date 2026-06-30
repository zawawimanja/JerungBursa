const axios = require('axios');

const symbols = [
    { name: 'BETA', code: '0263.KL' },
    { name: 'RADIUM', code: '5313.KL' },
    { name: 'SSF', code: '0287.KL' },
    { name: 'ECOMATE', code: '0239.KL' },
    { name: 'MRDIY', code: '5296.KL' },
    { name: 'SDCG', code: '0311.KL' }
];

async function run() {
    const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
    for (const sym of symbols) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym.code}?interval=1d&range=3mo`;
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
                        volume: volume[i] || 0,
                        turnover: (close[i] * (volume[i] || 0))
                    });
                }
            }

            // Let's analyze the last 20 trading days
            const last20 = validDays.slice(-20);
            if (last20.length === 0) continue;

            let sumTurnover = 0;
            let flatDays = 0;
            let zeroVolDays = 0;
            let smallRangeDays = 0; // high - low <= 1 tick (typically RM0.005 or RM0.01)

            last20.forEach(d => {
                sumTurnover += d.turnover;
                if (d.high === d.low) {
                    flatDays++;
                }
                if (d.volume === 0) {
                    zeroVolDays++;
                }
                // Range <= 1 tick
                const tickRange = d.high - d.low;
                if (tickRange <= 0.0051) {
                    smallRangeDays++;
                }
            });

            const avgTurnover = sumTurnover / last20.length;
            const flatPct = (flatDays / last20.length) * 100;
            const smallRangePct = (smallRangeDays / last20.length) * 100;

            console.log(`\n=== ANALYSIS FOR ${sym.name} (${sym.code}) ===`);
            console.log(`Average Daily Turnover (last 20d): RM ${avgTurnover.toLocaleString(undefined, {maximumFractionDigits:2})}`);
            console.log(`Flat Days (High == Low): ${flatDays}/${last20.length} (${flatPct.toFixed(1)}%)`);
            console.log(`Small Range Days (Range <= 0.005): ${smallRangeDays}/${last20.length} (${smallRangePct.toFixed(1)}%)`);
        } catch (e) {
            console.error(`Failed to fetch for ${sym.name}: ${e.message}`);
        }
    }
}

run();
