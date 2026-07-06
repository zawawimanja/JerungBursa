const axios = require('axios');
async function check() {
    try {
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/5326.KL?interval=1d&range=5d`);
        console.log(res.data.chart.result[0].meta);
    } catch (e) {
        console.log('Error fetching 5326.KL');
    }
}
check();
