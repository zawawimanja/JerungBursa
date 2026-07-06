const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

const lwsabah = currentData.find(s => s.name === 'LWSABAH');
console.log("=== LWSABAH DATA ===");
if (lwsabah) {
    console.log(JSON.stringify(lwsabah, null, 2));
    
    // Simulate the index.html filter logic
    const floorIndex = lwsabah.floorLow || (lwsabah.price * 0.95);
    const distToFloorIndex = ((lwsabah.price - floorIndex) / floorIndex) * 100;
    console.log(`- floorLow from JSON: ${lwsabah.floorLow}`);
    console.log(`- Simulated index.html floor: ${floorIndex}`);
    console.log(`- Simulated index.html distToFloor: ${distToFloorIndex.toFixed(2)}%`);
} else {
    console.log("LWSABAH NOT FOUND!");
}
