const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, 'symbol_mappings.json'), 'utf8'));

// Convert timestamp (seconds) to Malaysian local date string (UTC+8)
function getLocalDate(ts) {
    const date = new Date((ts + 8 * 3600) * 1000);
    return date.toISOString().split('T')[0];
}

async function recalculateArchive(dateStr) {
    const archivePath = path.join(__dirname, 'history', `data_${dateStr}.json`);
    if (!fs.existsSync(archivePath)) {
        console.error(`❌ File archive untuk ${dateStr} tidak dijumpai di: ${archivePath}`);
        return;
    }
    
    console.log(`\n==================================================`);
    console.log(`⏳ Memulakan pengiraan semula arkib untuk tarikh: ${dateStr}`);
    console.log(`==================================================`);
    
    const dataObj = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
    const list = dataObj.topVolume || [];
    
    const total = list.length;
    let count = 0;
    
    for (const item of list) {
        count++;
        const symbol = mappings[item.name];
        if (!symbol) {
            console.log(`[${count}/${total}] ⚠️ Tiada simbol ditemui untuk ${item.name}, melangkau...`);
            continue;
        }
        
        console.log(`[${count}/${total}] Mengira semula ${item.name} (${symbol})...`);
        
        try {
            // 1. Fetch daily data
            const dailyRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, { headers: HEADERS });
            if (!dailyRes.data || !dailyRes.data.chart || !dailyRes.data.chart.result || !dailyRes.data.chart.result[0]) continue;
            
            const dailyResult = dailyRes.data.chart.result[0];
            const dTimestamps = dailyResult.timestamp;
            const dQuote = dailyResult.indicators.quote[0];
            const dClose = dQuote.close;
            const dLow = dQuote.low;
            const dHigh = dQuote.high;
            const dOpen = dQuote.open;
            
            const validDays = [];
            for (let i = 0; i < dTimestamps.length; i++) {
                const ts = dTimestamps[i];
                const dDate = getLocalDate(ts);
                if (dDate > dateStr) continue; // Potong data selepas tarikh arkib
                
                if (dClose[i] !== null && dClose[i] !== undefined && dLow[i] !== null && dLow[i] !== undefined && dHigh[i] !== null && dHigh[i] !== undefined && dOpen[i] !== null && dOpen[i] !== undefined) {
                    validDays.push({
                        close: dClose[i],
                        open: dOpen[i],
                        low: dLow[i],
                        high: dHigh[i],
                        date: dDate
                    });
                }
            }
            
            if (validDays.length < 2) continue;

            const closesDaily = validDays.map(d => d.close).filter(c => c !== null && c !== undefined);
            const sma50 = closesDaily.length >= 50
                ? closesDaily.slice(-50).reduce((a, b) => a + b, 0) / 50
                : (closesDaily.reduce((a, b) => a + b, 0) / closesDaily.length);
            const hasEnoughSmaData = closesDaily.length >= 20;
            
            const sma200 = closesDaily.length >= 200
                ? closesDaily.slice(-200).reduce((a, b) => a + b, 0) / 200
                : (closesDaily.reduce((a, b) => a + b, 0) / closesDaily.length);
                
            item.sma50 = sma50;
            item.sma200 = sma200;
            
            // Cari 52W High up to target date
            let high52 = 0;
            validDays.forEach(d => {
                if (d.high > high52) high52 = d.high;
            });
            item.high52 = high52;
                 // Kira daily floor dengan 10-day lookback (TradingView 1D CS Match)
            const lastDays = validDays.slice(-4);
            const lastDay = lastDays[lastDays.length - 1];
            const currentPrice = lastDay.close;
            
            const closes = lastDays.map(d => d.close);
            const maxClose = Math.max(...closes);
            const minClose = Math.min(...closes);
            const closeTightness = ((maxClose - minClose) / minClose) * 100;
            
            const pullbackValForFloor = high52 ? (((high52 - currentPrice) / high52) * 100) : 0;
            
            const lookback10 = Math.min(10, validDays.length);
            const dailyLookback10 = validDays.slice(-lookback10);
            const lows10 = dailyLookback10.map(d => d.low);
            const floor10 = Math.min(...lows10);
            const dist10 = ((currentPrice - floor10) / floor10) * 100;
            
            let touch10 = 0;
            dailyLookback10.forEach(d => {
                if (((d.low - floor10) / floor10) * 100 <= 2.0) touch10++;
            });
            
            const lookback5 = Math.min(5, validDays.length);
            const dailyLookback5 = validDays.slice(-lookback5);
            const lows5 = dailyLookback5.map(d => d.low);
            const floor5 = Math.min(...lows5);
            const dist5 = ((currentPrice - floor5) / floor5) * 100;
            
            let touch5 = 0;
            dailyLookback10.forEach(d => {
                if (Math.abs(((d.low - floor5) / floor5) * 100) <= 2.0) touch5++;
            });

            const lookback3 = Math.min(3, validDays.length);
            const dailyLookback3 = validDays.slice(-lookback3);
            const lows3 = dailyLookback3.map(d => d.low);
            const floor3 = Math.min(...lows3);

            // Determine which floor to use:
            let minLow = floor10;
            let touchCount = touch10;
            
            if (validDays.length < 25) {
                minLow = floor5;
                touchCount = touch5;
            } else if (pullbackValForFloor <= 5.0 && floor3 >= floor10 * 1.03) {
                // For strong ATH/breakout runners, we use the recent 3-day support floor
                minLow = floor3;
                let touch3 = 0;
                dailyLookback10.forEach(d => {
                    if (Math.abs(((d.low - floor3) / floor3) * 100) <= 2.0) touch3++;
                });
                touchCount = touch3;
            } else if (floor5 >= floor10 * 1.03) {
                minLow = floor5;
                touchCount = touch5;
            } else if (dist10 > 3.0) {
                if (dist5 <= 4.0 && (touch5 >= 2 || closeTightness <= 5.5)) {
                    minLow = floor5;
                    touchCount = Math.max(touch5, 2);
                }
            }
            
            const floorDist = ((currentPrice - minLow) / minLow) * 100;
            const maxLow = Math.max(...(validDays.length < 25 ? lows5 : (minLow === floor5 ? lows5 : lows10)));
            const lowTightness = ((maxLow - minLow) / minLow) * 100;

            // Hitung Lower Wick Rejection harian (Ekor di bawah)
            const dailyBody = Math.abs(lastDay.close - lastDay.open);
            const dailyLowerShadow = Math.min(lastDay.open, lastDay.close) - lastDay.low;
            const dailyTotalRange = lastDay.high - lastDay.low;
            
            const isDojiConsolidation = (dailyBody / currentPrice <= 0.015) && (floorDist <= 1.5);
            
            const hasLowerWickRejection = (dailyTotalRange > 0 && (
                (dailyLowerShadow / dailyTotalRange >= 0.20) || 
                (dailyBody > 0 && dailyLowerShadow / dailyBody >= 0.40) ||
                (dailyBody === 0 && dailyLowerShadow > 0)
            )) || isDojiConsolidation;

            item.closeTightness = parseFloat(closeTightness.toFixed(2));
            item.lowTightness = parseFloat(lowTightness.toFixed(2));
            item.touchCount = touchCount;
            item.floorLow = minLow;
            
            const pullback = ((high52 - currentPrice) / high52) * 100;
            // Consolidation: pullback <= 15%, short-term close tightness <= 5.5%, and must have touchCount >= minTouchCountRequired
            const minTouchCountRequired = (validDays.length < 25 || minLow === floor5) ? 2 : 3;
            let isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && touchCount >= minTouchCountRequired);
            item.isConsolidation = isConsolidation;
            
            // Recalculate pullback setupName
            item.pullback = pullback !== null ? parseFloat(pullback.toFixed(2)) : null;
            const isSmaDowntrend = (sma50 && hasEnoughSmaData) ? (item.price < sma50) : false;
            const isSma200Downtrend = sma200 ? (item.price < sma200) : false;
            
            // Logik pintar: Pullback sehingga 40% dibenarkan jika harga di atas SMA200 (Long-term Bullish)
            // Jika tidak, had pullback adalah 30%
            const maxPullbackAllowed = (!isSma200Downtrend && sma200) ? 40.0 : 30.0;

            if (isSmaDowntrend || pullback > maxPullbackAllowed) {
                item.setupName = '🧊 Downtrend / Avoid';
            } else if (pullback <= 5.0) {
                item.setupName = '🔥 RBS Retest / Near ATH';
            } else if (pullback <= 15.0) {
                item.setupName = '📉 Healthy Dip';
            } else if (pullback <= 40.0) {
                item.setupName = '🔻 Buy Support / Deep Pullback';
            }
            
            let setupStyle = 'SWING PLAY';
            if (pullback !== null) {
                if (item.changePct >= 5.0 || (item.changePct >= 3.5 && pullback > 5.0)) {
                    setupStyle = 'EXPLOSIVE';
                } else if (pullback <= 10.0 && (isConsolidation || lowTightness <= 8.0 || touchCount >= 2)) {
                    setupStyle = 'STAIRCASE';
                }
            }
            item.setupStyle = setupStyle;
            
            // Recalculate signal and reason
            let signal = 'avoid';
            let reason = 'Jerung Buang / Mendatar';
            
            if (item.setupName === '🧊 Downtrend / Avoid') {
                signal = 'avoid';
                reason = '🧊 Saham Downtrend: Elak Trading!';
            } else if (isConsolidation) {
                signal = 'buy';
                if (item.price < 0.20) {
                    reason = '⚠️ Penny Goreng: Tapak Tegar (Intraday Sahaja, Elak Hold!)';
                } else if (item.price >= 1.50) {
                    reason = '🔥 Golden Hold: Tapak Tegar Selesa (Sesuai Swing/Hold)';
                } else {
                    reason = '🔥 Golden Entry: Tapak Tegar Selesa (Sesuai Swing/Hold)';
                }
            } else if (item.change > 0 && item.turnover >= 250000) {
                signal = 'buy';
                if (item.price < 0.20) {
                    reason = '⚠️ Penny Goreng: Pam Volume Laju (Intraday Sahaja, Elak Hold!)';
                } else if (item.price >= 1.50) {
                    if (item.changePct <= 3.0) {
                        reason = '🔥 Golden Hold: Jerung Mula Kumpul (Sesuai Swing/Hold)';
                    } else {
                        reason = '⚡ Momentum Bluechip: Jerung Pam Kuat (Sesuai Swing/Hold)';
                    }
                } else {
                    if (item.changePct <= 3.0) {
                        reason = '🔥 Golden Entry: Jerung Kumpul Selesa (Sesuai Swing/Hold)';
                    } else {
                        reason = '⚡ Momentum Kuat: Jerung Mula Pam (Sesuai Intraday/Swing)';
                    }
                }
            } else if (item.isVip || mappings[item.name]) { // VIP or listed
                reason = 'VIP Sideway / Pullback (Pantau Peluang)';
            }
            
            if (pullback <= 5.0 && item.setupName !== '🧊 Downtrend / Avoid') {
                reason += ' (Near ATH)';
            } else if (pullback <= 15.0) {
                reason += ' (Healthy Dip)';
            } else if (pullback <= 40.0) {
                reason += ' (Pullback Support)';
            }
            
            item.signal = signal;
            item.reason = isConsolidation ? `🔒 Tapak Tegar (${item.touchCount}x) | ${reason}` : reason;
            item.hasLowerWickRejection = hasLowerWickRejection;
            
        } catch (e) {
            console.error(`❌ Gagal mengemas kini ${item.name}: ${e.message}`);
        }
    }
    
    // Simpan fail yang dikemaskini
    fs.writeFileSync(archivePath, JSON.stringify(dataObj, null, 2));
    console.log(`\n✅ Berjaya mengemas kini fail arkib: ${archivePath}`);
}

async function run() {
    const historyDir = path.join(__dirname, 'history');
    const files = fs.readdirSync(historyDir);
    const jsonFiles = files.filter(f => f.startsWith('data_') && f.endsWith('.json')).sort();
    
    console.log(`Menjumpai ${jsonFiles.length} fail arkib untuk dikira semula...`);
    for (const file of jsonFiles) {
        const dateStr = file.replace('data_', '').replace('.json', '');
        await recalculateArchive(dateStr);
    }
    console.log('\n🎉 Pengemaskinian Sejarah Selesai Sepenuhnya!');
}

run();
