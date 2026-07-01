const fs = require('fs');
const path = require('path');

const histDir = path.join(__dirname, '..', 'history');
const files = fs.readdirSync(histDir)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

const historyData = [];

// Load all historical data
files.forEach(file => {
    const dateStr = file.replace('data_', '').replace('.json', '');
    const raw = fs.readFileSync(path.join(histDir, file), 'utf8');
    const data = JSON.parse(raw);
    const stocks = Array.isArray(data) ? data : (data.topVolume || []);
    historyData.push({ date: dateStr, stocks });
});

console.log(`Loaded ${historyData.length} days of historical records for backtesting.`);

const backtestResults = {
    STAIRCASE: [],
    EXPLOSIVE: []
};

// Map of date index for fast lookup
const dateToIndex = {};
historyData.forEach((h, idx) => {
    dateToIndex[h.date] = idx;
});

// Run backtest
for (let i = 0; i < historyData.length - 1; i++) {
    const entryDay = historyData[i];
    const entryDate = entryDay.date;
    
    // Filter reversals on entry day
    const candidates = entryDay.stocks.filter(item => {
        if (!item.high52) return false;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        
        // Reversal filter criteria
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
        // Calculate setupStyle
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
            const slPrice = floorPrice * 0.97; // 3% below floor
            
            // Look forward
            const futurePerformance = {};
            let hitStopLoss = false;
            let maxGain = 0;

            for (let offset = 1; offset <= 5; offset++) {
                const targetIdx = i + offset;
                if (targetIdx >= historyData.length) break;
                
                const targetDay = historyData[targetIdx];
                const matchedStock = targetDay.stocks.find(s => s.name === item.name);
                
                if (matchedStock) {
                    const priceToday = matchedStock.price;
                    
                    // Check if stop loss is hit during these days (using daily low as approximation)
                    // If we don't have low, we approximate with price.
                    const lowToday = matchedStock.floorLow ? (priceToday * 0.95) : priceToday; // conservative
                    
                    if (priceToday <= slPrice) {
                        hitStopLoss = true;
                    }
                    
                    const gain = ((priceToday - entryPrice) / entryPrice) * 100;
                    if (gain > maxGain) maxGain = gain;
                    
                    futurePerformance[`T+${offset}`] = hitStopLoss ? -((entryPrice - slPrice)/entryPrice*100) : gain;
                }
            }

            backtestResults[style].push({
                name: item.name,
                entryDate,
                entryPrice,
                slPrice,
                futurePerformance,
                maxGain: hitStopLoss ? 0 : maxGain,
                hitStopLoss
            });
        }
    });
}

// Print Backtest Performance
['STAIRCASE', 'EXPLOSIVE'].forEach(style => {
    const samples = backtestResults[style];
    console.log(`\n==================================================`);
    console.log(`📊 PERFORMANSI BACKTEST SETUP: ${style}`);
    console.log(`==================================================`);
    console.log(`Jumlah Setup Ditemui: ${samples.length}`);
    
    if (samples.length === 0) {
        console.log('Tiada sampel yang cukup.');
        return;
    }

    let winT2 = 0;
    let winT5 = 0;
    let sumT2 = 0;
    let countT2 = 0;
    let sumT5 = 0;
    let countT5 = 0;
    let slHits = 0;

    samples.forEach(s => {
        if (s.hitStopLoss) slHits++;
        
        if (s.futurePerformance['T+2'] !== undefined) {
            const perf = s.futurePerformance['T+2'];
            sumT2 += perf;
            countT2++;
            if (perf > 0) winT2++;
        }
        if (s.futurePerformance['T+5'] !== undefined) {
            const perf = s.futurePerformance['T+5'];
            sumT5 += perf;
            countT5++;
            if (perf > 0) winT5++;
        }
    });

    console.log(`Kadar Hit Stop Loss (SL Hit %): ${(slHits / samples.length * 100).toFixed(2)}%`);
    console.log(`Purata Pulangan T+2: ${(sumT2 / countT2).toFixed(2)}% (Win Rate: ${(winT2 / countT2 * 100).toFixed(2)}%)`);
    console.log(`Purata Pulangan T+5: ${(sumT5 / countT5).toFixed(2)}% (Win Rate: ${(winT5 / countT5 * 100).toFixed(2)}%)`);
    
    console.log(`\n📋 Contoh Trade Terbaik (${style}):`);
    const sortedSamples = [...samples].sort((a, b) => b.maxGain - a.maxGain).slice(0, 5);
    sortedSamples.forEach((s, idx) => {
        console.log(`  ${idx+1}. ${s.name} | Masuk: ${s.entryDate} (RM ${s.entryPrice.toFixed(3)}) | Max Gain: +${s.maxGain.toFixed(2)}% | Status SL: ${s.hitStopLoss ? 'HIT' : 'OK'}`);
    });
});
