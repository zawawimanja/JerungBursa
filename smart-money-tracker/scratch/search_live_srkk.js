const fs = require('fs');
const file = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const topVolume = data.topVolume || [];
const found = topVolume.find(s => s.name.toUpperCase().includes('SRKK'));
console.log("SRKK in live_data.json:", JSON.stringify(found, null, 2));
