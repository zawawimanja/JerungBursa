const fs = require('fs');
const path = require('path');

const histFile = path.join(__dirname, '../history/data_2026-07-02.json');
const raw = JSON.parse(fs.readFileSync(histFile, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

const ams = data.find(s => s.name === 'AMS');

console.log("=== AMS DATA FOR JULY 2ND, 2026 ===");
if (ams) {
    console.log(JSON.stringify(ams, null, 2));
    
    // Check if it passes the index.html filter criteria:
    const isIpo = ams.ipoGrade === 'A' || ams.ipoGrade === 'B' || ams.ipoGrade === 'C';
    const isPremiumIpo = ams.ipoGrade === 'A' || ams.ipoGrade === 'B';
    const minTurnover = isIpo ? 400000 : 750000;
    const passTurnover = ams.turnover >= minTurnover;
    
    const pullbackVal = ams.pullback !== null ? ams.pullback : 0;
    const isAboveSma200 = ams.sma200 ? ams.price >= ams.sma200 : false;
    const maxPullbackLimit = isIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
    const passPullback = pullbackVal >= 0 && pullbackVal <= maxPullbackLimit;
    
    console.log(`\n--- Verification checklist: ---`);
    console.log(`- Is IPO? ${isIpo} (Grade: ${ams.ipoGrade})`);
    console.log(`- Current Price: RM ${ams.price}`);
    console.log(`- Turnover: RM ${ams.turnover.toLocaleString()} (Need >= ${minTurnover.toLocaleString()}): ${passTurnover}`);
    console.log(`- Pullback: ${pullbackVal.toFixed(1)}% (Need <= ${maxPullbackLimit}%): ${passPullback}`);
    console.log(`- Signal: "${ams.signal}" (Is it 'avoid' or 'buy'?)`);
    console.log(`- Setup Style: "${ams.setupStyle}"`);
} else {
    console.log("AMS was not found in the July 2nd file!");
}
