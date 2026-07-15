const fs = require('fs');
const path = require('path');

const historyDir = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/JerungBursa/smart-money-tracker/history';

// 1. Get all history files and sort by date
const files = fs.readdirSync(historyDir)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

const snapshots = [];
files.forEach(file => {
    const dateStr = file.replace('data_', '').replace('.json', '');
    const filePath = path.join(historyDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.topVolume) {
            // Clean up: exclude BURSA index and any stock with price = 0
            const cleanStocks = data.topVolume.filter(s => 
                s.name !== 'BURSA' && 
                s.price > 0 && 
                s.price < 500 // Bursa Malaysia stocks are rarely > RM100, index or errors are
            );
            snapshots.push({
                date: dateStr,
                stocks: cleanStocks
            });
        }
    } catch (e) {
        console.error(`Error parsing ${file}:`, e);
    }
});

console.log(`Loaded ${snapshots.length} valid trading days. Cleaning anomalies...`);

// Helper to look up a stock's price on subsequent days
function getSubsequentPrices(stockName, startIndex, maxDays = 10) {
    const prices = [];
    const endIndex = Math.min(snapshots.length, startIndex + 1 + maxDays);
    let prevPrice = null;
    
    for (let i = startIndex + 1; i < endIndex; i++) {
        const dayStocks = snapshots[i].stocks;
        const match = dayStocks.find(s => s.name.toUpperCase() === stockName.toUpperCase());
        if (match) {
            const p = match.price;
            
            // Check for impossible day-to-day jumps (Bursa limit up is 30%)
            // If the price jumps by more than 50% in one trading day, it's a data error
            if (prevPrice !== null) {
                const ratio = p / prevPrice;
                if (ratio > 1.5 || ratio < 0.3) {
                    // Skip this stock due to data contamination
                    return null;
                }
            } else {
                // Check jump from entryPrice
                const entryPrice = snapshots[startIndex].stocks.find(s => s.name.toUpperCase() === stockName.toUpperCase()).price;
                const ratio = p / entryPrice;
                if (ratio > 2.0 || ratio < 0.1) { // 2.0x within a few days or dropping to 10% is anomalous
                    return null;
                }
            }
            
            prices.push({
                date: snapshots[i].date,
                price: p
            });
            prevPrice = p;
        }
    }
    return prices;
}

// 3. Track performance of buy signals
const trades = [];

snapshots.forEach((snap, idx) => {
    const date = snap.date;
    const stocks = snap.stocks;
    
    stocks.forEach(stock => {
        if (stock.signal === 'buy') {
            const entryPrice = stock.price;
            if (!entryPrice || entryPrice <= 0) return;
            
            const futureDays = getSubsequentPrices(stock.name, idx, 10);
            if (futureDays === null || futureDays.length === 0) return; // Skip contaminated or insufficient data
            
            let maxPrice = entryPrice;
            let minPrice = entryPrice;
            let firstHitTarget10 = false;
            let firstHitTarget20 = false;
            let hitStopLoss3 = false;
            let hitStopLoss5 = false;
            let exitPrice = futureDays[futureDays.length - 1].price;
            
            for (let i = 0; i < futureDays.length; i++) {
                const p = futureDays[i].price;
                if (p > maxPrice) maxPrice = p;
                if (p < minPrice) minPrice = p;
                
                const currentGain = ((p - entryPrice) / entryPrice) * 100;
                
                if (currentGain <= -3.0 && !hitStopLoss3) hitStopLoss3 = true;
                if (currentGain <= -5.0 && !hitStopLoss5) hitStopLoss5 = true;
                if (currentGain >= 10.0 && !firstHitTarget10) firstHitTarget10 = true;
                if (currentGain >= 20.0 && !firstHitTarget20) firstHitTarget20 = true;
            }
            
            const maxGain = ((maxPrice - entryPrice) / entryPrice) * 100;
            const maxDrawdown = ((minPrice - entryPrice) / entryPrice) * 100;
            
            trades.push({
                name: stock.name,
                entryDate: date,
                entryPrice,
                setupStyle: stock.setupStyle || 'SWING PLAY',
                turnover: stock.turnover,
                maxGain,
                maxDrawdown,
                hitStopLoss3,
                hitStopLoss5,
                firstHitTarget10,
                firstHitTarget20,
                finalGain: ((exitPrice - entryPrice) / entryPrice) * 100
            });
        }
    });
});

console.log(`Generated ${trades.length} clean trade records for backtesting.`);

function runAnalysis(filterFn, categoryName) {
    const filteredTrades = trades.filter(filterFn);
    if (filteredTrades.length === 0) {
        console.log(`\n=== Category: ${categoryName} ===\nNo trades match this filter.`);
        return;
    }
    
    let totalMaxGain = 0;
    let totalMaxDrawdown = 0;
    let hitSL3Count = 0;
    let hitSL5Count = 0;
    let reachT10Count = 0;
    let reachT20Count = 0;
    let explosiveMovers = 0;
    
    filteredTrades.forEach(t => {
        totalMaxGain += t.maxGain;
        totalMaxDrawdown += t.maxDrawdown;
        if (t.hitStopLoss3) hitSL3Count++;
        if (t.hitStopLoss5) hitSL5Count++;
        if (t.firstHitTarget10) reachT10Count++;
        if (t.firstHitTarget20) reachT20Count++;
        if (t.maxGain >= 15.0) explosiveMovers++;
    });
    
    const count = filteredTrades.length;
    console.log(`
=== Category: ${categoryName} ===
Total Trades: ${count}
Avg Max Gain: ${(totalMaxGain / count).toFixed(2)}%
Avg Max Drawdown: ${(totalMaxDrawdown / count).toFixed(2)}%
Hit Stop Loss 3%: ${hitSL3Count} (${((hitSL3Count / count) * 100).toFixed(1)}%)
Hit Stop Loss 5%: ${hitSL5Count} (${((hitSL5Count / count) * 100).toFixed(1)}%)
Reached TP 10%: ${reachT10Count} (${((reachT10Count / count) * 100).toFixed(1)}%)
Reached TP 20%: ${reachT20Count} (${((reachT20Count / count) * 100).toFixed(1)}%)
Explosive Movers (>= 15% Gain): ${explosiveMovers} (${((explosiveMovers / count) * 100).toFixed(1)}%)
`);
}

runAnalysis(t => true, "ALL BUY SIGNALS");
runAnalysis(t => t.setupStyle === 'EXPLOSIVE', "EXPLOSIVE SETUPS ONLY");
runAnalysis(t => t.setupStyle === 'STAIRCASE', "STAIRCASE SETUPS ONLY");
runAnalysis(t => t.setupStyle === 'SWING PLAY', "SWING PLAY SETUPS ONLY");

runAnalysis(t => t.entryPrice < 1.00, "PENNY STOCKS ONLY (< RM 1.00)");
runAnalysis(t => t.entryPrice >= 1.00, "HEAVY STOCKS ONLY (>= RM 1.00)");

runAnalysis(t => t.entryPrice < 1.00 && t.setupStyle === 'EXPLOSIVE', "PENNY + EXPLOSIVE SETUPS ONLY");
runAnalysis(t => t.entryPrice >= 1.00 && t.setupStyle === 'STAIRCASE', "HEAVY + STAIRCASE SETUPS ONLY");
