const fs = require('fs');
const path = require('path');

const liveDataPath = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

const target = "UMC";
data.forEach(item => {
    if (item.name.toUpperCase().includes(target)) {
        console.log(`Match for ${target}: Name="${item.name}", Price=${item.price}, IPO Price=${item.ipoPrice}`);
    }
});
