const fs = require('fs');
const file = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const topVolume = data.topVolume || [];
const srkkai = topVolume.find(s => s.name.toUpperCase().includes('SRKKAI') || s.name.toUpperCase().includes('SRKK-WA'));
console.log("SRKKAI properties:", JSON.stringify(srkkai, null, 2));
