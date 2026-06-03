const fs = require('fs');
const data = JSON.parse(fs.readFileSync('history/data_2026-06-03.json', 'utf8'));
const currentData = Array.isArray(data) ? data : (data.topVolume || []);

const filteredData = currentData.filter(item => {
    if (item.price < 0.3) return false;
    if (item.price > 50) return false;
    if (item.turnover < 3000000) return false;
    if ((item.changePct !== undefined ? item.changePct : item.change) <= 0) return false;
    return true;
});
console.log("2026-06-03 records:", filteredData.length);
