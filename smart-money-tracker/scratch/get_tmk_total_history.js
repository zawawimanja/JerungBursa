const axios = require('axios');

async function getTmkTotalHistory() {
    const ticker = '5330.KL';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=300d`;
    try {
        const res = await axios.get(url);
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp || [];
        console.log(`First date on Yahoo Finance: ${new Date(timestamps[0] * 1000).toISOString().split('T')[0]}`);
        console.log(`Total days: ${timestamps.length}`);
    } catch (e) {
        console.error(e);
    }
}

getTmkTotalHistory();
