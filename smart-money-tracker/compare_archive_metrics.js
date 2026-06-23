const fs = require('fs');
const path = require('path');

const yesterdayPath = path.join(__dirname, 'history', 'data_2026-06-22.json');
const todayPath = path.join(__dirname, 'history', 'data_2026-06-23.json');

const yData = JSON.parse(fs.readFileSync(yesterdayPath, 'utf8'));
const tData = JSON.parse(fs.readFileSync(todayPath, 'utf8'));

const yList = yData.topVolume || [];
const tList = tData.topVolume || [];

const yMap = new Map(yList.map(item => [item.name, item]));
const tMap = new Map(tList.map(item => [item.name, item]));

console.log('==================================================');
console.log('📊 COMPARISON REPORT: JUNE 22 VS JUNE 23 (CORRECTED DATA)');
console.log('==================================================\n');

// 1. BROAD HEALTH METRICS
const yBuyCount = yList.filter(x => x.signal === 'buy').length;
const tBuyCount = tList.filter(x => x.signal === 'buy').length;
const yConsolCount = yList.filter(x => x.isConsolidation).length;
const tConsolCount = tList.filter(x => x.isConsolidation).length;

console.log('1. Broad Market Health:');
console.log(`- Total buy signals: Yesterday = ${yBuyCount} | Today = ${tBuyCount} (Dropdown: -${yBuyCount - tBuyCount})`);
console.log(`- Consolidated stocks: Yesterday = ${yConsolCount} | Today = ${tConsolCount}`);
console.log('');

// 2. STOP LOSS TRIGGERS (Floor Broken)
console.log('2. Support Floors Broken (Stop Loss Triggered @ -3% below Yesterday\'s Floor):');
const brokenFloors = [];
yList.forEach(yStock => {
    const tStock = tMap.get(yStock.name);
    if (tStock) {
        const yFloor = yStock.floorLow;
        const ySL = yFloor * 0.97;
        if (tStock.price < ySL) {
            brokenFloors.push({
                name: yStock.name,
                yPrice: yStock.price,
                tPrice: tStock.price,
                yFloor: yFloor,
                ySL: ySL,
                changePct: tStock.changePct
            });
        }
    }
});

if (brokenFloors.length > 0) {
    brokenFloors.forEach(x => {
        console.log(`- 🔴 ${x.name}: Fell from RM ${x.yPrice.toFixed(3)} to RM ${x.tPrice.toFixed(3)} (${x.changePct.toFixed(2)}%), breaking Yesterday's Floor of RM ${x.yFloor.toFixed(3)} (SL was RM ${x.ySL.toFixed(3)})`);
    });
} else {
    console.log('- None');
}
console.log('');

// 3. RETESTS HELD (Touch count increased or price stayed above floor)
console.log('3. Support Floors Held (Retested & touch count increased):');
const heldFloors = [];
tList.forEach(tStock => {
    const yStock = yMap.get(tStock.name);
    if (yStock) {
        // If yesterday floor is close to today floor, and today touch count is >= yesterday touch count
        if (Math.abs(tStock.floorLow - yStock.floorLow) / yStock.floorLow < 0.01) {
            if (tStock.touchCount > yStock.touchCount) {
                heldFloors.push({
                    name: tStock.name,
                    price: tStock.price,
                    floor: tStock.floorLow,
                    yTouches: yStock.touchCount,
                    tTouches: tStock.touchCount,
                    changePct: tStock.changePct
                });
            }
        }
    }
});

if (heldFloors.length > 0) {
    heldFloors.forEach(x => {
        console.log(`- 🟢 ${x.name}: Price RM ${x.price.toFixed(3)} (${x.changePct.toFixed(2)}%). Floor RM ${x.floor.toFixed(3)} held and retested: touches increased from ${x.yTouches}x ➡️ ${x.tTouches}x`);
    });
} else {
    console.log('- None');
}
console.log('');

// 4. SIGNAL CHANGES (Buy to Avoid, Avoid to Buy)
console.log('4. Signal Shifts (Buy ➡️ Avoid):');
tList.forEach(tStock => {
    const yStock = yMap.get(tStock.name);
    if (yStock && yStock.signal === 'buy' && tStock.signal === 'avoid') {
        console.log(`- ⚠️ ${tStock.name}: Buy ➡️ Avoid (Price RM ${tStock.price.toFixed(3)} | Chg ${tStock.changePct.toFixed(2)}% | Reason: ${tStock.reason})`);
    }
});
console.log('');

console.log('5. Signal Shifts (Avoid ➡️ Buy):');
tList.forEach(tStock => {
    const yStock = yMap.get(tStock.name);
    if (yStock && yStock.signal === 'avoid' && tStock.signal === 'buy') {
        console.log(`- 💎 ${tStock.name}: Avoid ➡️ Buy (Price RM ${tStock.price.toFixed(3)} | Chg ${tStock.changePct.toFixed(2)}% | Reason: ${tStock.reason})`);
    }
});
console.log('');
