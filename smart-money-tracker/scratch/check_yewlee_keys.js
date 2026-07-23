const fs = require('fs');
const file = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const topVolume = data.topVolume || [];
const yewlee = topVolume.find(s => s.name.toUpperCase().includes('YEWLEE'));
console.log("YEWLEE properties:", JSON.stringify(yewlee, null, 2));
