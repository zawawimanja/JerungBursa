const fs = require('fs');
const file = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = data.topVolume || [];

const vcpBases = list.filter(s => {
    if (s.price >= 1.0 || s.price <= 0) return false;
    if (s.isCombStock && s.turnover < 500000) return false;
    const floorDist = s.floorLow ? ((s.price - s.floorLow) / s.floorLow * 100) : 999;
    return s.setupStyle === 'STAIRCASE' && (s.touchCount || 0) >= 4 && floorDist <= 4.0;
});

// Sort by touches descending, then floor distance ascending
vcpBases.sort((a, b) => {
    if (b.touchCount !== a.touchCount) return (b.touchCount || 0) - (a.touchCount || 0);
    const floorA = a.floorLow || (a.price * 0.95);
    const distA = ((a.price - floorA) / floorA) * 100;
    const floorB = b.floorLow || (b.price * 0.95);
    const distB = ((b.price - floorB) / floorB) * 100;
    return distA - distB;
});

console.log("Filtered & Sorted Candidates in Kategori C:");
vcpBases.forEach((s, idx) => {
    const floorDist = s.floorLow ? ((s.price - s.floorLow) / s.floorLow * 100) : 0;
    console.log(`${idx+1}. Name: ${s.name} | Touches: ${s.touchCount}x | FloorDist: ${floorDist.toFixed(2)}% | Price: RM ${s.price.toFixed(3)} | Turnover: RM ${s.turnover.toFixed(0)} | isComb: ${s.isCombStock}`);
});
