const fs = require('fs');
const path = require('path');

const liveDataPath = path.join(__dirname, '../live_data.json');
if (!fs.existsSync(liveDataPath)) {
    console.error("live_data.json not found");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const topVolume = data.topVolume || [];

const watchlist = [
    'HKB', 'SUM', 'DNEX', 'MMCS', 'SKYECHIP', 'AMS', 'CNERGEN', 'OPPSTAR', 'MCLEAN', 
    'PENTECH', 'EIPOWER', 'ADNEX', 'SUNMED', 'CBHB', 'KEEMING', 'MNHLDG', 'LWSABAH', 
    'SDCG', 'NE', 'AMBEST', 'SAM', 'OGX', 'IAB'
];

console.log("=========================================================================");
console.log("🔍 WATCHLIST IN LIVE_DATA.JSON");
console.log("=========================================================================");
console.log("TICKER".padEnd(10) + "PRICE".padEnd(8) + "SIGNAL".padEnd(8) + "PULLBACK".padEnd(10) + "TIGHTNESS".padEnd(10) + "TOUCHES".padEnd(8) + "CONSOLIDATION".padEnd(15) + "REASON");
console.log("-".repeat(100));

watchlist.forEach(name => {
    const item = topVolume.find(x => x.name.toUpperCase() === name.toUpperCase());
    if (item) {
        console.log(
            item.name.padEnd(10) +
            `RM ${item.price.toFixed(3)}`.padEnd(8) +
            item.signal.toUpperCase().padEnd(8) +
            `${item.pullback !== null ? item.pullback.toFixed(2) + '%' : 'N/A'}`.padEnd(10) +
            `${item.closeTightness !== null ? item.closeTightness.toFixed(2) + '%' : 'N/A'}`.padEnd(10) +
            `${item.touchCount}x`.padEnd(8) +
            `${item.isConsolidation}`.padEnd(15) +
            item.reason
        );
    } else {
        console.log(`${name.padEnd(10)} ⚠️ NOT IN TOP_VOLUME IN LIVE_DATA.JSON`);
    }
});
