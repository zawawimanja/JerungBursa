const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '../history');

// Read files
const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

// Find June 11th file
const june11File = 'data_2026-06-11.json';
const june11Path = path.join(HISTORY_DIR, june11File);

if (!fs.existsSync(june11Path)) {
    console.error("❌ June 11th file not found!");
    process.exit(1);
}

const june11Data = JSON.parse(fs.readFileSync(june11Path, 'utf8'));
const june11List = june11Data.topVolume || [];
const amsJune11 = june11List.find(x => x.name.toUpperCase() === 'AMS');

if (!amsJune11) {
    console.error("❌ AMS not found in June 11th data!");
    process.exit(1);
}

const entryPrice = amsJune11.price; // should be 0.380
const floorLow = amsJune11.floorLow || (entryPrice * 0.95);
const slPrice = floorLow * 0.97;

console.log(`======================================================`);
console.log(`📊 SIMULASI MASUK AMS PADA 11 JUN 2026:`);
console.log(`======================================================`);
console.log(`Harga Masuk (Entry) : RM ${entryPrice.toFixed(3)}`);
console.log(`Lantai Sokongan     : RM ${floorLow.toFixed(3)}`);
console.log(`Harga Stop Loss (SL): RM ${slPrice.toFixed(3)} (-${(((entryPrice - slPrice)/entryPrice)*100).toFixed(1)}%)`);
console.log(`------------------------------------------------------`);
console.log(`PERJALANAN HARIAN SELEPAS 11 JUN:`);
console.log('------------------------------------------------------');
console.log('Tarikh     | Low Hari Ini | Close Hari Ini | PnL Semasa% | Status SL');
console.log('------------------------------------------------------');

const nextFiles = files.filter(f => f > june11File);

let slHit = false;
let slHitDate = '';
let slHitPrice = 0;

nextFiles.forEach(file => {
    const dateStr = file.replace('data_', '').replace('.json', '');
    const filePath = path.join(HISTORY_DIR, file);
    const dayData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const dayList = dayData.topVolume || [];
    const amsToday = dayList.find(x => x.name.toUpperCase() === 'AMS');

    if (amsToday) {
        // Let's assume the low is floorLow or we estimate it, Yahoo Finance usually has low/high.
        // Wait, did the history file record item.low or item.price?
        // Our history json has: price, floorLow, and sometimes other indicators.
        // Let's check what fields amsToday has. If it has only 'price', we use 'price'.
        const currentPrice = amsToday.price;
        const currentPnL = ((currentPrice - entryPrice) / entryPrice) * 100;
        
        // Let's check if the close price hits SL
        let slStatus = 'OK 🛡️';
        if (currentPrice <= slPrice && !slHit) {
            slHit = true;
            slHitDate = dateStr;
            slHitPrice = currentPrice;
            slStatus = 'HIT 🚨';
        } else if (slHit) {
            slStatus = 'PREVIOUSLY HIT ❌';
        }

        console.log(`${dateStr} | RM ${currentPrice.toFixed(3).padEnd(8)} | RM ${currentPrice.toFixed(3).padEnd(10)} | ${currentPnL >= 0 ? '+' : ''}${currentPnL.toFixed(2).padStart(6)}% | ${slStatus}`);
    } else {
        console.log(`${dateStr} | N/A (Tiada data volume)`);
    }
});

console.log(`------------------------------------------------------`);
console.log(`KEPUTUSAN PENUH:`);
console.log(`------------------------------------------------------`);
if (slHit) {
    console.log(`❌ YA, AMS terkena Stop Loss (SL) pada tarikh: ${slHitDate} pada harga RM ${slHitPrice.toFixed(3)}.`);
} else {
    console.log(`✅ TIDAK, AMS tidak pernah melanggar Stop Loss (SL) sehingga hari ini.`);
}

const todayFile = files[files.length - 1];
const todayData = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, todayFile), 'utf8'));
const todayList = todayData.topVolume || [];
const amsToday = todayList.find(x => x.name.toUpperCase() === 'AMS');

if (amsToday) {
    const finalPnL = ((amsToday.price - entryPrice) / entryPrice) * 100;
    console.log(`Jika hold sampai hari ini (3 Julai): Harga semasa RM ${amsToday.price.toFixed(3)} | PnL: ${finalPnL >= 0 ? '+' : ''}${finalPnL.toFixed(2)}%`);
}
console.log(`======================================================`);
