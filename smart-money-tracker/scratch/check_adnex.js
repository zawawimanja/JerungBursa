const fs = require('fs');

const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const yesterdayPath = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\history\\data_2026-07-22.json";

console.log('=== Checking ADNEX (0396) Data ===');

if (fs.existsSync(yesterdayPath)) {
    const fileContent = JSON.parse(fs.readFileSync(yesterdayPath, 'utf8'));
    const adnexYesterday = (fileContent.topVolume || []).find(item => item.name === 'ADNEX');
    if (adnexYesterday) {
        console.log('\n--- ADNEX Yesterday (22-Jul-2026) ---');
        console.log(JSON.stringify(adnexYesterday, null, 2));
    } else {
        console.log('ADNEX not found in yesterday\'s data');
    }
}

if (fs.existsSync(pathJerungLive)) {
    const fileContent = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));
    const adnexToday = (fileContent.topVolume || []).find(item => item.name === 'ADNEX');
    if (adnexToday) {
        console.log('\n--- ADNEX Today (23-Jul-2026) ---');
        console.log(JSON.stringify(adnexToday, null, 2));
    } else {
        console.log('ADNEX not found in today\'s data');
    }
}
