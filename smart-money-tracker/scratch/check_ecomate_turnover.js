const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'live_data.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const list = Array.isArray(data) ? data : (data.topVolume || []);

const eco = list.find(item => item.name === 'ECOMATE');
if (eco) {
    console.log("ECOMATE properties:");
    console.log(JSON.stringify(eco, null, 2));
} else {
    console.log("ECOMATE not found in live_data.json");
}
