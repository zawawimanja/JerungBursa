const fs = require('fs');

const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));

console.log('Keys of live_data:', Object.keys(live));
if (live.topVolume) {
    console.log('topVolume type:', typeof live.topVolume);
    if (Array.isArray(live.topVolume)) {
        console.log('topVolume count:', live.topVolume.length);
        console.log('Sample topVolume:', live.topVolume.slice(0, 3));
    }
}
if (live.topGainers) {
    console.log('topGainers count:', live.topGainers.length);
}

// Let's search inside live_data.json (which is a large file, maybe we can search for EIPOWER, MMCS, SRKK in the raw string)
const raw = fs.readFileSync(pathJerungLive, 'utf8');
console.log('Raw string contains:');
console.log('  EIPOWER:', raw.includes('EIPOWER'));
console.log('  MMCS:', raw.includes('MMCS'));
console.log('  SRKK:', raw.includes('SRKK'));
console.log('  STRATUS:', raw.includes('STRATUS'));

// Let's look at tracker_data.js
const trackerPath = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\tracker_data.js";
if (fs.existsSync(trackerPath)) {
    const rawTracker = fs.readFileSync(trackerPath, 'utf8');
    console.log('\ntracker_data.js contains:');
    console.log('  EIPOWER:', rawTracker.includes('EIPOWER'));
    console.log('  MMCS:', rawTracker.includes('MMCS'));
    console.log('  SRKK:', rawTracker.includes('SRKK'));
}
