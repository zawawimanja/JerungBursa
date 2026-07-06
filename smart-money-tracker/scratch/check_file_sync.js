const fs = require('fs');
const path = require('path');

const liveJsonPath = path.join(__dirname, '../live_data.json');
const liveJsPath = path.join(__dirname, '../live_data.js');
const todayHistoryPath = path.join(__dirname, '../history/data_2026-07-06.json');

console.log("=== FILE DETAILS ===");
[liveJsonPath, liveJsPath, todayHistoryPath].forEach(p => {
    if (fs.existsSync(p)) {
        const stats = fs.statSync(p);
        console.log(`${path.basename(p)}: size=${stats.size} bytes, modified=${stats.mtime.toISOString()}`);
    } else {
        console.log(`${path.basename(p)}: DOES NOT EXIST!`);
    }
});

// Check if HEGROUP is in today's history vs live_data.json
const historyRaw = fs.existsSync(todayHistoryPath) ? JSON.parse(fs.readFileSync(todayHistoryPath, 'utf8')) : [];
const historyList = Array.isArray(historyRaw) ? historyRaw : (historyRaw.topVolume || []);
console.log(`\nToday's history has ${historyList.length} counters. HEGROUP present: ${historyList.some(s => s.name === 'HEGROUP')}`);

const liveRaw = fs.existsSync(liveJsonPath) ? JSON.parse(fs.readFileSync(liveJsonPath, 'utf8')) : {};
const liveList = Array.isArray(liveRaw) ? liveRaw : (liveRaw.topVolume || []);
console.log(`live_data.json has ${liveList.length} counters. HEGROUP present: ${liveList.some(s => s.name === 'HEGROUP')}`);
if (liveRaw.lastUpdated) {
    console.log(`live_data.json lastUpdated field: ${liveRaw.lastUpdated}`);
}
