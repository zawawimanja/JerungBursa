const fs = require('fs');

const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));

const targets = ['CNERGEN', '3REN', 'EIPOWER', 'RESTNGO'];

console.log('=== Debugging JB Picks Candidates ===');
targets.forEach(name => {
    const s = live.topVolume.find(item => item.name === name);
    if (!s) {
        console.log(`- ${name}: Not found in topVolume`);
        return;
    }
    console.log(`\n- ${name} details:`);
    console.log(`  Price: ${s.price}`);
    console.log(`  Signal: ${s.signal}`);
    console.log(`  SetupStyle: ${s.setupStyle}`);
    
    const floorDist = s.floorLow ? ((s.price - s.floorLow) / s.floorLow * 100) : null;
    console.log(`  FloorLow: ${s.floorLow} (Dist: ${floorDist !== null ? floorDist.toFixed(2) + '%' : 'null'})`);
    console.log(`  Turnover: ${s.turnover}`);
    console.log(`  IpoGrade: ${s.ipoGrade} | IpoYear: ${s.ipoYear}`);
    
    // Check match criteria
    if (!s.price || s.price >= 1.0) {
        console.log(`  --> Filtered out: Price >= 1.0 or empty`);
        return;
    }
    if (s.signal !== 'buy') {
        console.log(`  --> Filtered out: Signal is not buy`);
        return;
    }
    if (!['STAIRCASE', 'EXPLOSIVE', 'SWING PLAY'].includes(s.setupStyle)) {
        console.log(`  --> Filtered out: setupStyle not in [STAIRCASE, EXPLOSIVE, SWING PLAY]`);
        return;
    }
    if (floorDist !== null && floorDist > 10.0) {
        console.log(`  --> Filtered out: floorDist > 10.0% (${floorDist.toFixed(2)}%)`);
        return;
    }
    
    // Let's check matchesIpoAgeFilter (default FRESH)
    // matchesIpoAgeFilter code:
    // function matchesIpoAgeFilter(item, filterVal) {
    //     if (filterVal === 'FRESH') {
    //         return (item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C') && (item.ipoYear && item.ipoYear >= 2025);
    //     }
    //     ...
    // }
    const isFreshIpo = (s.ipoGrade === 'A' || s.ipoGrade === 'B' || s.ipoGrade === 'C') && (s.ipoYear && s.ipoYear >= 2025);
    console.log(`  IsFreshIpo: ${isFreshIpo}`);
    if (!isFreshIpo) {
        console.log(`  --> Filtered out: Not a FRESH IPO (ipoAgeFilter is FRESH by default)`);
    } else {
        console.log(`  --> LULUS filter candidates!`);
    }
});
