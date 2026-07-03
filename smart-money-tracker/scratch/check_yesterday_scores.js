const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../history/data_2026-07-02.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const list = Array.isArray(data) ? data : (data.topVolume || []);

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    let floorScore = 0;
    if (distToFloor <= 1.5) floorScore = 4;
    else if (distToFloor <= 3.0) floorScore = 2;
    else if (distToFloor <= 5.0) floorScore = 1;
    score += floorScore;
    
    let touchScore = 0;
    if (item.touchCount >= 5) touchScore = 3;
    else if (item.touchCount >= 3) touchScore = 2;
    else if (item.touchCount >= 2) touchScore = 1;
    score += touchScore;
    
    let consScore = item.isConsolidation ? 2 : 0;
    score += consScore;
    
    let pbScore = 0;
    if (pullbackVal <= 5.0) pbScore = 3;
    else if (pullbackVal <= 12.0) pbScore = 2;
    else if (pullbackVal <= 25.0) pbScore = 1;
    score += pbScore;
    
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    let sma50Score = isAboveSma50 ? 2 : 0;
    let sma200Score = isAboveSma200 ? 1 : 0;
    score += sma50Score;
    score += sma200Score;
    
    let turnScore = item.turnover >= 5000000 ? 1 : 0;
    score += turnScore;
    
    return {
        score,
        breakdown: {
            floorScore,
            distToFloor,
            touchScore,
            consScore,
            pbScore,
            sma50Score,
            sma200Score,
            turnScore
        }
    };
}

const targetNames = ['EIPOWER', 'ICENTS'];

targetNames.forEach(name => {
    const item = list.find(x => x.name.toUpperCase() === name);
    console.log(`\n======================================================`);
    console.log(`🔍 DETAIL SAHAM ${name} PADA TARIKH 2 JULAI (SEMALAM):`);
    console.log(`======================================================`);
    if (!item) {
        console.log(`Kaunter tidak dijumpai dalam senarai data semalam!`);
        return;
    }

    const { score, breakdown } = calculateSmartScore(item);
    const isBouncing = item.change > 0;
    const isAvoid = item.setupName && (item.setupName.includes('Downtrend') || item.setupName.includes('Avoid') || item.setupName === 'N/A');

    console.log(`Harga Penutup : RM ${item.price.toFixed(3)}`);
    console.log(`Peratus Ubah  : ${item.changePct}%`);
    console.log(`Turnover      : RM ${(item.turnover/1e6).toFixed(2)}M`);
    console.log(`Pullback      : ${item.pullback}%`);
    console.log(`Setup Name    : ${item.setupName}`);
    console.log(`Bouncing?     : ${isBouncing ? 'YA ✅' : 'TIDAK ❌ (Sebab change <= 0)'}`);
    console.log(`Avoid?        : ${isAvoid ? 'YA ❌' : 'TIDAK ✅'}`);
    console.log(`Skor Smart    : ${score} / 15`);
    console.log(`Pecahan Skor  :`);
    console.log(`  - Floor Proximity (${breakdown.distToFloor.toFixed(1)}%): +${breakdown.floorScore}`);
    console.log(`  - Floor Touches (${item.touchCount}x): +${breakdown.touchScore}`);
    console.log(`  - Consolidation: +${breakdown.consScore}`);
    console.log(`  - Pullback Zone: +${breakdown.pbScore}`);
    console.log(`  - Above SMA50: +${breakdown.sma50Score}`);
    console.log(`  - Above SMA200: +${breakdown.sma200Score}`);
    console.log(`  - Big Turnover (>5M): +${breakdown.turnScore}`);
    console.log(`------------------------------------------------------`);
    console.log(`SEBAB UTAMA REJECT:`);
    
    const reasons = [];
    if (!isBouncing) reasons.push(`❌ Kaunter tidak ditutup hijau (Bouncing). Syarat asas wajib ditutup hijau.`);
    if (item.turnover < 750000) reasons.push(`❌ Turnover harian kurang daripada RM 750k (Turnover semalam: RM ${(item.turnover/1e3).toFixed(1)}k).`);
    if (score < 8) reasons.push(`❌ Skor Smart (${score}) kurang daripada kelayakan minimum Teknik C (≥ 8).`);
    
    reasons.forEach((r, i) => console.log(`  ${i+1}. ${r}`));
    console.log(`======================================================`);
});
