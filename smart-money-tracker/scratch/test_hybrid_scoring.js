const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '../history');
const SYMBOL_MAPPINGS_FILE = path.join(__dirname, '../symbol_mappings.json');
const HTML_FILE = path.join(__dirname, '../backtest.html');

async function runSimulation() {
    // Read history files starting from 2026-06-22
    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('data_') && f.endsWith('.json'))
        .sort();
        
    const targetFiles = files.filter(f => {
        const dateStr = f.replace('data_', '').replace('.json', '');
        return dateStr >= '2026-06-22';
    });
    
    // We need targetFiles to track performance
    console.log(`Analyzing ${targetFiles.length} history files...`);
    
    // We will build a mapping of stock name -> daily history of prices to evaluate trades
    const stockHistory = {};
    
    targetFiles.forEach(file => {
        const dateStr = file.replace('data_', '').replace('.json', '');
        const filePath = path.join(HISTORY_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const list = data.topVolume || data.processedData || [];
        
        list.forEach(item => {
            const name = item.name.toUpperCase();
            if (!stockHistory[name]) stockHistory[name] = [];
            stockHistory[name].push({
                date: dateStr,
                price: item.price,
                change: item.change,
                changePct: item.changePct || 0,
                high: item.high || item.price,
                low: item.low || item.price,
                floorLow: item.floorLow || (item.price * 0.95),
                turnover: item.turnover || 0
            });
        });
    });

    // Sort each stock's history by date
    for (const name in stockHistory) {
        stockHistory[name].sort((a,b) => a.date.localeCompare(b.date));
    }

    // Helper to evaluate a trade starting on dateStr
    function evaluateTrade(name, entryPrice, floorLow, entryDateStr) {
        const history = stockHistory[name];
        if (!history) return { finalGain: 0, status: 'NO_DATA', maxGain: 0 };
        
        const entryIdx = history.findIndex(h => h.date === entryDateStr);
        if (entryIdx === -1) return { finalGain: 0, status: 'NO_DATA', maxGain: 0 };
        
        const stopLossPrice = floorLow * 0.97;
        const maxDaysAhead = 10;
        const nextIdxStart = entryIdx + 1;
        const nextIdxEnd = Math.min(history.length - 1, entryIdx + maxDaysAhead);
        
        if (nextIdxStart > nextIdxEnd) {
            // No future data yet
            return { finalGain: 0, status: 'HOLDING', maxGain: 0 };
        }
        
        let isSlHit = false;
        let maxHigh = entryPrice;
        let finalPrice = entryPrice;
        
        for (let i = nextIdxStart; i <= nextIdxEnd; i++) {
            const dayHigh = history[i].price; // Fallback to close price as high/low since history might not have full daily high/low
            const dayLow = history[i].price;
            const dayClose = history[i].price;
            
            if (dayLow <= stopLossPrice && !isSlHit) {
                isSlHit = true;
                finalPrice = stopLossPrice;
            }
            
            if (!isSlHit) {
                if (dayHigh > maxHigh) maxHigh = dayHigh;
                finalPrice = dayClose;
            }
        }
        
        const maxGain = entryPrice > 0 ? (((maxHigh - entryPrice) / entryPrice) * 100) : 0;
        const finalGain = entryPrice > 0 ? (((finalPrice - entryPrice) / entryPrice) * 100) : 0;
        
        let status = 'LOSS';
        if (isSlHit) status = 'SL_HIT';
        else if (finalGain >= 5.0) status = 'PROFIT_BIG';
        else if (finalGain > 0.0) status = 'PROFIT';
        else if (finalGain === 0) status = 'FLAT';
        
        return { finalGain, status, maxGain, exitPrice: finalPrice };
    }

    // Scoring function
    function calculateSmartScore(item) {
        let score = 0;
        const price = item.price;
        const floorLow = item.floorLow || (price * 0.95);
        const distToFloor = ((price - floorLow) / floorLow) * 100;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const changePct = item.changePct !== undefined ? item.changePct : 0;
        
        // 1. Proximity to Floor (Safer Entry)
        if (distToFloor <= 1.5) score += 4;
        else if (distToFloor <= 3.0) score += 2;
        else if (distToFloor <= 5.0) score += 1;
        
        // 2. Floor Strength (Support touches)
        if (item.touchCount >= 5) score += 3;
        else if (item.touchCount >= 3) score += 2;
        else if (item.touchCount >= 2) score += 1;
        
        // 3. Consolidation Base
        if (item.isConsolidation) score += 2;
        
        // 4. Zon Emas Pullback (ATH / RBS)
        if (pullbackVal <= 5.0) score += 3; // RBS/Near ATH
        else if (pullbackVal <= 12.0) score += 2; // Healthy pullback
        else if (pullbackVal <= 25.0) score += 1;
        
        // 5. SMA Trend Crossover
        const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
        const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
        if (isAboveSma50) score += 2;
        if (isAboveSma200) score += 1;
        
        // 6. High volume spike confirmation (Liquidity score booster)
        if (item.turnover >= 5000000) score += 1;
        
        return score;
    }

    const compiledTrades = [];

    // Simulate day-by-day
    for (let d = 0; d < targetFiles.length; d++) {
        const file = targetFiles[d];
        const dateStr = file.replace('data_', '').replace('.json', '');
        const filePath = path.join(HISTORY_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const list = data.topVolume || data.processedData || [];
        
        const dayCandidates = [];
        
        list.forEach(item => {
            const pullbackVal = item.pullback !== null ? item.pullback : 0;
            const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
            const maxPullback = isAboveSma200 ? 40.0 : 30.0;
            
            const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullback;
            const isBouncing = item.change > 0;
            const isDowntrend = item.setupName && (
                item.setupName.includes('Downtrend') || 
                item.setupName.includes('Avoid') || 
                item.setupName === 'N/A'
            );
            
            // Relax turnover threshold to >= RM 1.5 Million to capture mid-caps!
            const passFilters = hasPullback && 
                   isBouncing && 
                   !isDowntrend && 
                   item.price >= 0.25 && item.price <= 4.00 && 
                   item.turnover >= 1500000 && 
                   !item.isCombStock;
                   
            if (!passFilters) return;
            
            // Determine Setup Style
            let style = 'SWING PLAY';
            const changePct = item.changePct !== undefined ? item.changePct : 0;
            if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
                style = 'EXPLOSIVE';
            } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
                style = 'STAIRCASE';
            }
            
            if (style === 'EXPLOSIVE' || style === 'STAIRCASE') {
                const score = calculateSmartScore(item);
                dayCandidates.push({
                    name: item.name,
                    style: style,
                    price: item.price,
                    floorLow: item.floorLow || (item.price * 0.95),
                    turnover: item.turnover,
                    score: score,
                    pullback: pullbackVal,
                    touchCount: item.touchCount || 0,
                    distToFloor: ((item.price - (item.floorLow || (item.price * 0.95))) / (item.floorLow || (item.price * 0.95))) * 100
                });
            }
        });
        
        // Separate by style
        const explosives = dayCandidates.filter(c => c.style === 'EXPLOSIVE');
        const staircases = dayCandidates.filter(c => c.style === 'STAIRCASE');
        
        // Sort by smart score descending, tiebreaker is turnover descending
        const sortFn = (a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.turnover - a.turnover;
        };
        
        explosives.sort(sortFn);
        staircases.sort(sortFn);
        
        const pickExp = explosives[0];
        const pickStair = staircases[0];
        
        console.log(`\n📅 Date: ${dateStr}`);
        if (pickExp) {
            const outcome = evaluateTrade(pickExp.name, pickExp.price, pickExp.floorLow, dateStr);
            console.log(`   🔥 EXPLOSIVE Pick: ${pickExp.name} | Price: RM ${pickExp.price.toFixed(3)} | Score: ${pickExp.score} | Turnover: RM ${(pickExp.turnover/1e6).toFixed(2)}M | Dist Floor: ${pickExp.distToFloor.toFixed(1)}% | Outcome: ${outcome.status} (${outcome.finalGain >= 0 ? '+' : ''}${outcome.finalGain.toFixed(2)}%)`);
            compiledTrades.push({ name: pickExp.name, style: 'EXPLOSIVE', date: dateStr, price: pickExp.price, turnover: pickExp.turnover, score: pickExp.score, outcome });
        } else {
            console.log(`   🔥 EXPLOSIVE Pick: NONE`);
        }
        
        if (pickStair) {
            const outcome = evaluateTrade(pickStair.name, pickStair.price, pickStair.floorLow, dateStr);
            console.log(`   🪜 STAIRCASE Pick: ${pickStair.name} | Price: RM ${pickStair.price.toFixed(3)} | Score: ${pickStair.score} | Turnover: RM ${(pickStair.turnover/1e6).toFixed(2)}M | Dist Floor: ${pickStair.distToFloor.toFixed(1)}% | Outcome: ${outcome.status} (${outcome.finalGain >= 0 ? '+' : ''}${outcome.finalGain.toFixed(2)}%)`);
            compiledTrades.push({ name: pickStair.name, style: 'STAIRCASE', date: dateStr, price: pickStair.price, turnover: pickStair.turnover, score: pickStair.score, outcome });
        } else {
            console.log(`   🪜 STAIRCASE Pick: NONE`);
        }
    }
    
    // Overall Stats
    const activeTrades = compiledTrades.filter(t => t.outcome.status !== 'HOLDING' && t.outcome.status !== 'NO_DATA');
    const wins = activeTrades.filter(t => t.outcome.status.startsWith('PROFIT')).length;
    const slHits = activeTrades.filter(t => t.outcome.status === 'SL_HIT').length;
    const losses = activeTrades.filter(t => t.outcome.status === 'LOSS').length;
    const totalReturn = activeTrades.reduce((sum, t) => sum + t.outcome.finalGain, 0);
    
    console.log('\n==================================================');
    console.log('📈 KEPUTUSAN SIMULASI TEKNIK C SMART-SCORING:');
    console.log('==================================================');
    console.log(`Jumlah Trade Selesai  : ${activeTrades.length}`);
    console.log(`Menang (Profit)       : ${wins}`);
    console.log(`Terkena Stop Loss (SL): ${slHits}`);
    console.log(`Rugi Biasa (Loss)     : ${losses}`);
    console.log(`Kadar Kemenangan      : ${((wins / activeTrades.length) * 100).toFixed(2)}%`);
    console.log(`Kadar Stop Loss Hit   : ${((slHits / activeTrades.length) * 100).toFixed(2)}%`);
    console.log(`Purata Pulangan       : ${totalReturn >= 0 ? '+' : ''}${(totalReturn / activeTrades.length).toFixed(2)}%`);
    console.log('==================================================');
}

runSimulation().catch(console.error);
