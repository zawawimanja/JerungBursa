const fs = require('fs');
const data = JSON.parse(fs.readFileSync('live_data.json', 'utf8'));
const topVol = data.topVolume || (Array.isArray(data) ? data : []);

const akumulasi = topVol.filter(c => {
    const pct = c.changePct !== undefined ? c.changePct : c.change;
    return pct > 0 && pct <= 3.0 && c.turnover >= 3000000 && c.price <= 3.00 && c.signal === 'buy';
});

akumulasi.sort((a, b) => b.turnover - a.turnover);
console.log(JSON.stringify(akumulasi.slice(0, 5), null, 2));
