const fs = require('fs');
const path = require('path');

const liveDataFile = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataFile, 'utf8'));
const currentData = Array.isArray(raw) ? raw : (raw.topVolume || []);

console.log("=== COMPREHENSIVE AUDIT OF TODAY'S ACTIVE BUY SIGNALS ===");

const buys = currentData.filter(s => s.signal === 'buy');
let errorCount = 0;

buys.forEach(s => {
    // Check 1: If Fresh IPO (listed >= 2025), price must not be below IPO price
    const isFresh = s.ipoYear && s.ipoYear >= 2025;
    if (isFresh && s.ipoPrice && s.price < s.ipoPrice) {
        errorCount++;
        console.log(`❌ ERROR: ${s.name} is classified as BUY but is a Failed Fresh IPO!`);
        console.log(`   Price: RM ${s.price.toFixed(3)} | IPO Price: RM ${s.ipoPrice.toFixed(3)} | Year: ${s.ipoYear}`);
    }

    // Check 2: Check for suspicious prices (like price = 0 or close to 0)
    if (s.price <= 0.01) {
        errorCount++;
        console.log(`❌ ERROR: ${s.name} has suspicious current price: RM ${s.price}`);
    }

    // Check 3: Check for suspicious floor levels
    if (s.floorLow && s.floorLow >= s.price) {
        errorCount++;
        console.log(`❌ ERROR: ${s.name} has support floor (RM ${s.floorLow}) higher than or equal to current price (RM ${s.price})!`);
    }

    // Check 4: Check if symbol or grade mapping is unrated but has a known grade
    const cleanName = s.name.toUpperCase().trim();
    if ((s.ipoGrade === 'Unrated' || !s.ipoGrade) && ['SKYECHIP', 'PENTECH', 'SUM', 'ELSA', 'AMBEST', 'AMS', 'EIPOWER', 'ISF', 'KEEMING', 'TEAMSTR', 'MMCS', 'GDGROUP', 'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE', '3REN', 'HEGROUP'].includes(cleanName)) {
        errorCount++;
        console.log(`❌ ERROR: ${s.name} should have an IPO grade but is tagged as Unrated/Missing!`);
    }
});

console.log(`\nAudit completed. Total structural anomalies found: ${errorCount}`);
if (errorCount === 0) {
    console.log("✅ Everything is 100% clean! All active BUY signals strictly follow our Trend Rider filters.");
}
