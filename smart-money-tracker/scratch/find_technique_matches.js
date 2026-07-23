const fs = require('fs');
const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));

function checkMatches() {
    const results = {
        TR: [],
        ES: [],
        BF: []
    };

    live.topVolume.forEach(item => {
        if (!item || item.price <= 0 || item.price >= 1.00) return;
        if (item.isCombStock) return;

        const floor = item.floorLow || (item.price * 0.97);
        const distToFloor = ((item.price - floor) / floor) * 100;
        const touches = item.touchCount || 0;
        const pullback = item.pullback !== null ? item.pullback : 0;

        // 1. Trend Rider Match
        const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
        const minTouches = isIpo ? 1 : 3;
        if (distToFloor <= 5.0 && touches >= minTouches && pullback <= 20.0) {
            results.TR.push(item);
        }

        // 2. Early Spring Match
        if (item.openPrice) {
            const distToOpen = ((item.price - item.openPrice) / item.openPrice) * 100;
            const isTriggered = item.price >= item.openPrice;
            if (isTriggered && distToOpen <= 5.0 && touches >= 1) {
                results.ES.push(item);
            }
        }

        // 3. Bottom Fishing Match
        if (pullback >= 35.0 && distToFloor <= 5.0 && touches >= 3) {
            results.BF.push(item);
        }
    });

    console.log('=== VVIP TECHNIQUE MATCHES UNDER RM 1.00 ===');
    console.log('\n📈 [1. Trend Rider (TR)] (MNHLDG / KEEMING / HKB DNA):');
    if (results.TR.length === 0) console.log('  Tiada kaunter sepadan.');
    results.TR.forEach(item => {
        console.log(`  - ${item.name} | Price: RM ${item.price.toFixed(3)} | Signal: ${item.signal} | Pullback: ${item.pullback}% | Floor Dist: ${(((item.price - (item.floorLow || item.price*0.97)) / (item.floorLow || item.price*0.97)) * 100).toFixed(2)}% | Touches: ${item.touchCount}`);
    });

    console.log('\n🌸 [2. Early Spring (ES)] (MMCS / AMBEST / ADNEX DNA):');
    if (results.ES.length === 0) console.log('  Tiada kaunter sepadan.');
    results.ES.forEach(item => {
        const distToOpen = ((item.price - item.openPrice) / item.openPrice) * 100;
        console.log(`  - ${item.name} | Price: RM ${item.price.toFixed(3)} | Open: RM ${item.openPrice.toFixed(3)} | Dist to Open: +${distToOpen.toFixed(2)}% | Touches: ${item.touchCount}`);
    });

    console.log('\n🎣 [3. Bottom Fishing (BF)] (UUE / MCLEAN / TMK DNA):');
    if (results.BF.length === 0) console.log('  Tiada kaunter sepadan.');
    results.BF.forEach(item => {
        console.log(`  - ${item.name} | Price: RM ${item.price.toFixed(3)} | Pullback: ${item.pullback}% | Floor Dist: ${(((item.price - (item.floorLow || item.price*0.97)) / (item.floorLow || item.price*0.97)) * 100).toFixed(2)}% | Touches: ${item.touchCount}`);
    });
}

checkMatches();
