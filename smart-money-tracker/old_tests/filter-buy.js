const fs = require('fs');
const data = JSON.parse(fs.readFileSync('live_data.json', 'utf8'));
const topVol = data.topVolume || (Array.isArray(data) ? data : []);

const buys = topVol.filter(c => c.signal === 'buy');
buys.sort((a, b) => b.turnover - a.turnover);
console.log(JSON.stringify(buys.map(c => `${c.name}: RM${c.price} (+${c.changePct}%), Turnover: ${(c.turnover/1000000).toFixed(1)}M`), null, 2));
