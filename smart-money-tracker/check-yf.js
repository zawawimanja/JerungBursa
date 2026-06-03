const axios = require('axios');
const stocks = [
    { symbol: '0270.KL', name: 'NATGATE' },
    { symbol: '5309.KL', name: 'ITMAX' },
    { symbol: '7084.KL', name: 'QL' },
    { symbol: '5238.KL', name: 'AAX' },
    { symbol: '6888.KL', name: 'AXIATA' },
    { symbol: '4677.KL', name: 'YTL' },
    { symbol: '5296.KL', name: 'MRDIY' },
    { symbol: '0256.KL', name: 'SUNMED' }
];

async function check() {
    for (const s of stocks) {
        try {
            const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${s.symbol}?interval=1d&range=1d`);
            const meta = res.data.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const prev = meta.chartPreviousClose;
            const changePct = ((price - prev) / prev) * 100;
            console.log(`${s.name}: RM ${price.toFixed(3)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`);
        } catch (e) {
            console.log(`${s.name}: Failed to fetch`);
        }
    }
}
check();
