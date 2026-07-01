const fs = require('fs');
const path = require('path');

const histDir = path.join(__dirname, '..', 'history');
const files = fs.readdirSync(histDir)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

// We take the last 8 files (the last 7 entry days + July 1st for looking forward)
const lastFiles = files.slice(-8);

const historyData = [];
lastFiles.forEach(file => {
    const dateStr = file.replace('data_', '').replace('.json', '');
    const raw = fs.readFileSync(path.join(histDir, file), 'utf8');
    const data = JSON.parse(raw);
    const stocks = Array.isArray(data) ? data : (data.topVolume || []);
    historyData.push({ date: dateStr, stocks });
});

console.log(`Running backtest for the last 7 trading days (from ${historyData[0].date} to ${historyData[historyData.length-2].date})...`);

const trades = [];

for (let i = 0; i < historyData.length - 1; i++) {
    const entryDay = historyData[i];
    const entryDate = entryDay.date;
    
    const candidates = entryDay.stocks.filter(item => {
        if (!item.high52) return false;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const hasPullback = pullbackVal >= 0.5 && pullbackVal <= 25.0;
        const isBouncing = item.change > 0;
        const isDowntrend = item.setupName && (
            item.setupName.includes('Downtrend') || 
            item.setupName.includes('Avoid') || 
            item.setupName === 'N/A'
        );
        
        return hasPullback && isBouncing && !isDowntrend && 
               item.price >= 0.25 && item.price <= 4.00 && 
               item.turnover >= 250000 && !item.isCombStock;
    });

    candidates.forEach(item => {
        const changePct = item.changePct !== undefined ? item.changePct : 0;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        
        let style = 'SWING PLAY';
        if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
            style = 'EXPLOSIVE';
        } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
            style = 'STAIRCASE';
        }

        if (style === 'EXPLOSIVE' || style === 'STAIRCASE') {
            const entryPrice = item.price;
            const floorPrice = item.floorLow || (entryPrice * 0.97);
            const slPrice = floorPrice * 0.97;
            
            // Check maximum price reached and final price on July 1st (today)
            const finalDay = historyData[historyData.length - 1]; // July 1st
            const matchedStock = finalDay.stocks.find(s => s.name === item.name);
            
            let finalPrice = entryPrice;
            let hitStopLoss = false;
            let maxPriceSeen = entryPrice;

            // Check day-by-day path to check stop loss and max price
            for (let j = i + 1; j < historyData.length; j++) {
                const day = historyData[j];
                const dayStock = day.stocks.find(s => s.name === item.name);
                if (dayStock) {
                    if (dayStock.price <= slPrice) {
                        hitStopLoss = true;
                    }
                    if (dayStock.price > maxPriceSeen) {
                        maxPriceSeen = dayStock.price;
                    }
                    finalPrice = dayStock.price;
                }
            }

            const maxGain = ((maxPriceSeen - entryPrice) / entryPrice) * 100;
            const finalGain = ((finalPrice - entryPrice) / entryPrice) * 100;

            trades.push({
                date: entryDate,
                name: item.name,
                style,
                entryPrice,
                slPrice,
                finalPrice,
                maxGain,
                finalGain: hitStopLoss ? -((entryPrice - slPrice)/entryPrice*100) : finalGain,
                hitStopLoss
            });
        }
    });
}

// Print report
console.log('\n========================================================================');
console.log('📈 LAPORAN DETAIl HARI-BY-HARI (7 HARI TERAKHIR SEHINGGA 1 JULAI)');
console.log('========================================================================');
console.log('Tarikh   | Nama Saham | Setup     | Price Entry | Max Gain | Hasil Hari Ini (1/7)');
console.log('------------------------------------------------------------------------');

let totalWins = 0;
let totalLosses = 0;
let slHits = 0;

trades.forEach(t => {
    if (t.hitStopLoss) {
        slHits++;
        totalLosses++;
    } else if (t.finalGain > 0) {
        totalWins++;
    } else if (t.finalGain < 0) {
        totalLosses++;
    }
    
    const outcomeStr = t.hitStopLoss ? '🛑 SL HIT' : `${t.finalGain >= 0 ? '+' : ''}${t.finalGain.toFixed(2)}%`;
    console.log(`${t.date} | ${t.name.padEnd(10)} | ${t.style.padEnd(9)} | RM ${t.entryPrice.toFixed(3)}  | +${t.maxGain.toFixed(2)}% | ${outcomeStr}`);
});

console.log('========================================================================');
const total = totalWins + totalLosses;
console.log(`Jumlah Trade Diambil: ${trades.length}`);
console.log(`Kadar Hit Stop Loss (SL Hit %): ${(slHits / trades.length * 100).toFixed(2)}%`);
console.log(`Kadar Kemenangan Akhir (Final Win Rate): ${total > 0 ? ((totalWins / total * 100).toFixed(2)) : 0}%`);
