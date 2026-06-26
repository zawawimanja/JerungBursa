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
            
            // Cari 52W High up to target date
            let high52 = 0;
            validDays.forEach(d => {
                if (d.high > high52) high52 = d.high;
            });
            item.high52 = high52;
            
            // Kira daily fallback floor dengan wick filter
            const lastDays = validDays.slice(-4);
            const lastDay = lastDays[lastDays.length - 1];
            const currentPrice = lastDay.close;
            
            const closes = lastDays.map(d => d.close);
            const maxClose = Math.max(...closes);
            const minClose = Math.min(...closes);
            const closeTightness = ((maxClose - minClose) / minClose) * 100;
            
            const lows = lastDays.map(d => d.low);
            const validLows = lows.filter(l => l >= minClose * 0.95);
            const minLow = validLows.length > 0 ? Math.min(...validLows) : Math.min(...lows);
            
            const maxLow = Math.max(...lows);
            const lowTightness = ((maxLow - minLow) / minLow) * 100;

            // Hitung Lower Wick Rejection harian (Ekor di bawah)
            const dailyBody = Math.abs(lastDay.close - lastDay.open);
            const dailyLowerShadow = Math.min(lastDay.open, lastDay.close) - lastDay.low;
            const dailyTotalRange = lastDay.high - lastDay.low;
            
            const floorDist = ((currentPrice - minLow) / minLow) * 100;
            const isDojiConsolidation = (dailyBody / currentPrice <= 0.015) && (floorDist <= 1.5);
            
            const hasLowerWickRejection = (dailyTotalRange > 0 && (
                (dailyLowerShadow / dailyTotalRange >= 0.20) || 
                (dailyBody > 0 && dailyLowerShadow / dailyBody >= 0.40) ||
                (dailyBody === 0 && dailyLowerShadow > 0)
            )) || isDojiConsolidation;
            
            let touchCount = 0;
            lastDays.forEach(d => {
                const diffPct = ((d.low - minLow) / minLow) * 100;
                if (diffPct <= 2.0) {
                    touchCount++;
                }
            });
            
            item.closeTightness = parseFloat(closeTightness.toFixed(2));
            item.lowTightness = parseFloat(lowTightness.toFixed(2));
            item.touchCount = touchCount;
            item.floorLow = minLow;
            
            const pullback = ((high52 - currentPrice) / high52) * 100;
            let isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && (lowTightness <= 4.0 || touchCount >= 2));
            
            // 2. Fetch intraday 30m data
            if (pullback <= 30.0) {
                try {
                    const intraRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=30m&range=5d`, { headers: HEADERS });
                    if (intraRes.data && intraRes.data.chart && intraRes.data.chart.result && intraRes.data.chart.result[0]) {
                        const intraResult = intraRes.data.chart.result[0];
                        const iTimestamps = intraResult.timestamp;
                        const iQuote = intraResult.indicators.quote[0];
                        const iClose = iQuote.close || [];
                        const iLow = iQuote.low || [];
                        
                        const validCandles = [];
                        for (let j = 0; j < iTimestamps.length; j++) {
                            const ts = iTimestamps[j];
                            const iDate = getLocalDate(ts);
                            if (iDate > dateStr) continue; // Potong data selepas tarikh arkib
                            
                            if (iClose[j] !== null && iClose[j] !== undefined && iLow[j] !== null && iLow[j] !== undefined) {
                                validCandles.push({ close: iClose[j], low: iLow[j] });
                            }
                        }
                        
                        if (validCandles.length >= 12) {
                            const sampleCandles = validCandles.slice(-24);
                            const sampleCloses = sampleCandles.map(c => c.close);
                            const sampleLows = sampleCandles.map(c => c.low);
                            
                            const currentPriceIntra = sampleCloses[sampleCloses.length - 1];
                            const minAllowedLow = currentPriceIntra * 0.94;
                            const filteredLows = sampleLows.filter(l => l >= minAllowedLow);
                            
                            if (filteredLows.length >= 5) {
                                const recentLows = filteredLows.slice(-10);
                                const floorLow = Math.min(...recentLows);
                                
                                let intraTouches = 0;
                                sampleLows.forEach(l => {
                                    const diff = ((l - floorLow) / floorLow) * 100;
                                    if (Math.abs(diff) <= 2.5) {
                                        intraTouches++;
                                    }
                                });
                                
                                const last12Closes = sampleCloses.slice(-12);
                                const maxIntraClose = Math.max(...last12Closes);
                                const minIntraClose = Math.min(...last12Closes);
                                const intraCloseTightness = ((maxIntraClose - minIntraClose) / minIntraClose) * 100;
                                
                                // Sentiasa kemas kini floorLow dan touchCount berasaskan intraday 3 hari
                                item.floorLow = floorLow;
                                item.touchCount = intraTouches;
                                
                                if (intraCloseTightness <= 3.8 && intraTouches >= 4) {
                                    isConsolidation = true;
                                    item.closeTightness = parseFloat(intraCloseTightness.toFixed(2));
                                    item.isIntradayValidated = true;
                                }
                            }
                        }
                    }
                } catch (err) {
                    // Silently ignore or log error
                }
            }
            
            item.isConsolidation = isConsolidation;
            
            // Recalculate pullback setupName
            item.pullback = pullback !== null ? parseFloat(pullback.toFixed(2)) : null;
            const isSmaDowntrend = (sma50 && hasEnoughSmaData) ? (item.price < sma50) : false;

            if (isSmaDowntrend || pullback > 30.0) {
                item.setupName = '🧊 Downtrend / Avoid';
            } else if (pullback <= 5.0) {
                item.setupName = '🔥 RBS Retest / Near ATH';
            } else if (pullback <= 15.0) {
                item.setupName = '📉 Healthy Dip';
            } else if (pullback <= 30.0) {
                item.setupName = '🔻 Buy Support / Deep Pullback';
            }
            
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
            } else if (pullback <= 30.0) {
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
