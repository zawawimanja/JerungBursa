const fs = require('fs');

const todayData = JSON.parse(fs.readFileSync('live_data.json', 'utf8')).topVolume || [];
const targets = ["NATGATE", "ITMAX", "QL", "AAX", "AXIATA", "YTL", "MRDIY", "SUNMED"];

targets.forEach(t => {
    const stock = todayData.find(s => s.name === t);
    if (stock) {
        console.log(`${t}: RM ${stock.price} | Change: ${stock.changePct}% | Signal: ${stock.signal}`);
    } else {
        console.log(`${t}: Not in top volume today (Turnover < 3M or not most active)`);
    }
});
