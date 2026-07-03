const fs = require('fs');
const path = require('path');

// Target directory
const HISTORY_DIR = path.join(__dirname, '../history');
const LIVE_FILE = path.join(__dirname, '../live_data.json');

// Read files
const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

// Let's take files from the last 15 trading days
const targetFiles = files.filter(f => {
    const dateStr = f.replace('data_', '').replace('.json', '');
    return dateStr >= '2026-06-15';
});

const datesList = targetFiles.map(f => f.replace('data_', '').replace('.json', ''));

// Helper logic for indicators
function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;
    
    if (item.isConsolidation) score += 2;
    
    if (pullbackVal <= 5.0) score += 3;
    else if (pullbackVal <= 12.0) score += 2;
    else if (pullbackVal <= 25.0) score += 1;
    
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    if (item.turnover >= 5000000) score += 1;
    
    return score;
}

function isSleepingOrAvoidStock(item) {
    if (!item) return true;
    if (item.isCombStock) return true;
    
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
    
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('COMB') || reason.includes('AVOID') || reason.includes('ILLIQUID')) return true;
    
    return false;
}

// Map each file content by date
const dailyMarketData = {};
targetFiles.forEach(file => {
    const dateStr = file.replace('data_', '').replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8'));
    dailyMarketData[dateStr] = Array.isArray(data) ? data : (data.topVolume || []);
});

// Load live data
let liveList = [];
if (fs.existsSync(LIVE_FILE)) {
    const raw = JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8'));
    liveList = Array.isArray(raw) ? raw : (raw.topVolume || []);
}

// Generate picks for each historical date
const picksHistory = {};
datesList.forEach((dateStr) => {
    const list = dailyMarketData[dateStr];
    
    // Filter Technique C (Hibrid Premium) picks
    const hybridPicks = list.filter(item => {
        if (!item.high52) return false;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
        const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
        const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
        if (!hasPullback) return false;

        if (isSleepingOrAvoidStock(item)) return false;
        if (item.price < 0.25 || item.price > 4.00) return false;
        if (item.turnover < 750000) return false;
        if (calculateSmartScore(item) < 8) return false;

        const pct = item.changePct !== undefined ? item.changePct : item.change;
        const pb = item.pullback !== null ? item.pullback : 0;
        const style = item.setupStyle || (
            pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
                pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
            )
        );
        return style === 'EXPLOSIVE' || style === 'STAIRCASE';
    });

    // Sort Technique C
    const renderSortFn = (a, b) => {
        const scoreA = calculateSmartScore(a);
        const scoreB = calculateSmartScore(b);
        const isVvipA = (a.isVvip && scoreA >= 8) ? 1 : 0;
        const isVvipB = (b.isVvip && scoreB >= 8) ? 1 : 0;

        if (isVvipB !== isVvipA) return isVvipB - isVvipA;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.turnover - a.turnover;
    };
    
    const exps = hybridPicks.filter(item => {
        const pct = item.changePct !== undefined ? item.changePct : item.change;
        const pb = item.pullback !== null ? item.pullback : 0;
        const style = item.setupStyle || (
            pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : 'STAIRCASE'
        );
        return style === 'EXPLOSIVE';
    });
    const stairs = hybridPicks.filter(item => {
        const pct = item.changePct !== undefined ? item.changePct : item.change;
        const pb = item.pullback !== null ? item.pullback : 0;
        const style = item.setupStyle || (
            pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : 'STAIRCASE'
        );
        return style === 'STAIRCASE';
    });
    
    exps.sort(renderSortFn);
    stairs.sort(renderSortFn);
    
    const topHybrid = [...exps.slice(0, 6), ...stairs.slice(0, 6)];

    // Filter Super Trend picks
    const superTrendPicks = list.filter(item => {
        if (!item.high52) return false;
        if (isSleepingOrAvoidStock(item)) return false;
        if (item.price < 0.25 || item.price > 4.00) return false;
        if (item.turnover < 5000000) return false;
        if (calculateSmartScore(item) < 11) return false;
        
        const pct = item.changePct !== undefined ? item.changePct : item.change;
        const pb = item.pullback !== null ? item.pullback : 0;
        const style = item.setupStyle || (
            pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
                pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
            )
        );
        return style === 'EXPLOSIVE' || style === 'STAIRCASE';
    });
    superTrendPicks.sort((a, b) => b.turnover - a.turnover);

    picksHistory[dateStr] = {
        hybrid: topHybrid,
        superTrend: superTrendPicks
    };
});

// We want to simulate the daily path of each pick
const trackedTrades = [];

datesList.forEach((entryDate, idx) => {
    const picks = picksHistory[entryDate];
    
    // Simulate Technique C picks
    picks.hybrid.forEach(p => {
        const entryPrice = p.price;
        const floorPrice = p.floorLow || (entryPrice * 0.95);
        const slPrice = floorPrice * 0.97;
        const tp1Price = entryPrice * 1.10;
        const tp2Price = entryPrice * 1.20;

        let status = 'ACTIVE';
        let exitReason = '';
        let exitPrice = null;
        let exitDate = '';
        let daysHeld = 0;
        let pnl = 0;
        let highestPrice = entryPrice;

        // Trace forward day-by-day
        for (let i = idx + 1; i < datesList.length; i++) {
            daysHeld++;
            const dayDate = datesList[i];
            const marketToday = dailyMarketData[dayDate];
            const stockToday = marketToday.find(s => s.name === p.name);
            
            if (!stockToday) {
                // If not found in the daily active volume list, we assume it's flat/no change unless we hit 10 days
                if (daysHeld >= 10) {
                    status = 'EXIT';
                    exitReason = 'Time Stop (10 Days)';
                    exitPrice = exitPrice || entryPrice;
                    exitDate = dayDate;
                    break;
                }
                continue;
            }

            const current = stockToday.price;
            if (current > highestPrice) highestPrice = current;

            // Check SL first (Stop Loss at slPrice or hard max 10% loss)
            if (current <= slPrice || current <= (entryPrice * 0.90)) {
                status = 'EXIT';
                exitReason = 'Stop Loss Hit 🔴';
                exitPrice = Math.min(slPrice, entryPrice * 0.90);
                exitDate = dayDate;
                break;
            }

            // Check TP1
            if (current >= tp1Price && !exitReason.includes('TP1')) {
                // In a real trade, you exit 50% at TP1. We simplify backtest: if it hits TP2, we win TP2. 
                if (current >= tp2Price) {
                    status = 'EXIT';
                    exitReason = 'Target Profit 2 Hit 🟢🟢';
                    exitPrice = tp2Price;
                    exitDate = dayDate;
                    break;
                }
                // If 10 days limit hit after TP1
                if (daysHeld >= 10) {
                    status = 'EXIT';
                    exitReason = 'Time Stop (TP1 Hit) 🟢';
                    exitPrice = current;
                    exitDate = dayDate;
                    break;
                }
                // Mark that we hit TP1 but still holding the rest
                exitReason = 'TP1 Hit (+10%) 🟢';
                exitPrice = current; // temp
            }

            // Time Stop limit
            if (daysHeld >= 10) {
                status = 'EXIT';
                exitReason = exitReason.includes('TP1') ? 'Time Stop (TP1 Hit) 🟢' : 'Time Stop (Holding limit) ⚪';
                exitPrice = current;
                exitDate = dayDate;
                break;
            }
        }

        // Calculate current PnL or final PnL
        const finalExitPrice = exitPrice !== null ? exitPrice : (liveList.find(s => s.name === p.name)?.price || entryPrice);
        pnl = ((finalExitPrice - entryPrice) / entryPrice) * 100;

        trackedTrades.push({
            type: 'Technique C (Swing)',
            entryDate,
            name: p.name,
            entryPrice,
            currentPrice: liveList.find(s => s.name === p.name)?.price || entryPrice,
            floorPrice,
            slPrice,
            tp1Price,
            tp2Price,
            daysHeld,
            status,
            exitReason: exitReason || 'HOLD',
            pnl
        });
    });

    // Simulate VVIP Super Trend (Position Play)
    picks.superTrend.forEach(p => {
        const entryPrice = p.price;
        let highestPrice = entryPrice;

        let status = 'ACTIVE';
        let exitReason = '';
        let exitPrice = null;
        let exitDate = '';
        let daysHeld = 0;
        let pnl = 0;

        // Trace forward day-by-day
        for (let i = idx + 1; i < datesList.length; i++) {
            daysHeld++;
            const dayDate = datesList[i];
            const marketToday = dailyMarketData[dayDate];
            const stockToday = marketToday.find(s => s.name === p.name);
            
            if (!stockToday) {
                if (daysHeld >= 90) {
                    status = 'EXIT';
                    exitReason = 'Time Stop (90 Days) ⚪';
                    exitPrice = exitPrice || entryPrice;
                    exitDate = dayDate;
                    break;
                }
                continue;
            }

            const current = stockToday.price;
            if (current > highestPrice) highestPrice = current;

            // Trailing Stop 10%
            const trailingStopPrice = highestPrice * 0.90;
            if (current <= trailingStopPrice) {
                status = 'EXIT';
                exitReason = 'Trailing Stop Hit 10% 🔴';
                exitPrice = trailingStopPrice;
                exitDate = dayDate;
                break;
            }

            // 90 Days limit
            if (daysHeld >= 90) {
                status = 'EXIT';
                exitReason = 'Time Stop (90 Days limit) ⚪';
                exitPrice = current;
                exitDate = dayDate;
                break;
            }
        }

        const finalExitPrice = exitPrice !== null ? exitPrice : (liveList.find(s => s.name === p.name)?.price || entryPrice);
        pnl = ((finalExitPrice - entryPrice) / entryPrice) * 100;

        trackedTrades.push({
            type: 'Super Trend (Hold)',
            entryDate,
            name: p.name,
            entryPrice,
            currentPrice: liveList.find(s => s.name === p.name)?.price || entryPrice,
            floorPrice: highestPrice, // represent peak price
            slPrice: highestPrice * 0.90, // represent trailing stop
            tp1Price: null,
            tp2Price: null,
            daysHeld,
            status,
            exitReason: exitReason || 'HOLD',
            pnl
        });
    });
});

// Print active swings report
console.log('\n========================================================================================');
console.log('📡 LAPORAN PENGURUSAN SWING AKTIF JERUNGBURSA');
console.log('========================================================================================');

const activeTrades = trackedTrades.filter(t => t.status === 'ACTIVE' && t.entryDate >= datesList[datesList.length - 8]);
const exitTrades = trackedTrades.filter(t => t.status === 'EXIT' && t.entryDate >= datesList[datesList.length - 8]);

console.log('\n🔥 POSISI AKTIF (Syor Sedia Ada):');
console.log('-'.repeat(120));
console.log('Nama       | Jenis Teknik        | Tarikh Masuk | Entry Price | Harga Semasa | Stop Loss | Target TP1 | Pegangan | Hasil PnL% | Tindakan');
console.log('-'.repeat(120));

if (activeTrades.length === 0) {
    console.log('Tiada posisi aktif dalam tempoh 7 hari dagangan terakhir.');
} else {
    activeTrades.forEach(t => {
        const pnlStr = (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) + '%';
        const daysStr = t.daysHeld + ' Hari';
        
        let action = 'HOLD 🛡️';
        if (t.type.includes('Swing')) {
            if (t.currentPrice >= t.tp1Price) {
                action = 'TP1 HIT: JUAL 50% 💰';
            } else if (t.currentPrice <= t.slPrice) {
                action = 'SL HIT: CUT LOSS! 🚨';
            } else if (t.pnl >= 5.0) {
                action = 'HOLD (Tinggi) 📈';
            }
        } else {
            // Position play
            if (t.currentPrice <= t.slPrice) {
                action = 'TRAILING SL HIT: JUAL! 🚨';
            } else {
                action = 'RIDE THE TREND 💎';
            }
        }

        console.log(
            `${t.name.padEnd(10)} | ` +
            `${t.type.padEnd(19)} | ` +
            `${t.entryDate.padEnd(12)} | ` +
            `RM ${t.entryPrice.toFixed(3)}   | ` +
            `RM ${t.currentPrice.toFixed(3)}   | ` +
            `RM ${t.slPrice.toFixed(3)} | ` +
            `${t.tp1Price ? 'RM ' + t.tp1Price.toFixed(3) : 'N/A       '} | ` +
            `${daysStr.padEnd(8)} | ` +
            `${pnlStr.padStart(10)} | ` +
            `${action}`
        );
    });
}
console.log('-'.repeat(120));

console.log('\n🚪 ISYARAT EXIT TERBARU (Keluar Posisi):');
console.log('-'.repeat(120));
console.log('Nama       | Jenis Teknik        | Tarikh Masuk | Entry Price | Harga Exit  | PnL Akhir% | Sebab Keluar');
console.log('-'.repeat(120));

if (exitTrades.length === 0) {
    console.log('Tiada kaunter yang mencatatkan isyarat exit terbaru.');
} else {
    exitTrades.forEach(t => {
        const pnlStr = (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) + '%';
        console.log(
            `${t.name.padEnd(10)} | ` +
            `${t.type.padEnd(19)} | ` +
            `${t.entryDate.padEnd(12)} | ` +
            `RM ${t.entryPrice.toFixed(3)}   | ` +
            `RM ${t.slPrice.toFixed(3)}  | ` +
            `${pnlStr.padStart(10)} | ` +
            `${t.exitReason}`
        );
    });
}
console.log('-'.repeat(120));
console.log('SOP Swing: Keluar 50% di TP1 (+10%), bakinya di TP2 (+20%). Keluar penuh jika kena SL harian atau tamat tempoh 10 hari dagangan.');
console.log('========================================================================================\n');
