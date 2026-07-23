const fs = require('fs');
const path = require('path');
const file = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const topVolume = data.topVolume || [];
const sdcg = topVolume.find(s => s.name.toUpperCase().includes('SDCG'));
console.log("SDCG properties:", JSON.stringify(sdcg, null, 2));
