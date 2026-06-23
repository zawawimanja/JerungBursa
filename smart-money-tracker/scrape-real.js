const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const OUTPUT_FILE = path.join(__dirname, 'live_data.json');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
};

// Fungsi pembantu untuk tapisan dan parsing setiap baris jadual di i3investor
function parseTab($, tabSelector) {
    const stocks = [];
    $(tabSelector + ' .row.value').each((i, el) => {
        const cols = $(el).find('div[class*="col-"]');
        if (cols.length >= 4) {
            const name = $(cols[0]).find('strong').text().trim();
            const priceText = $(cols[1]).find('strong').text().trim();
            const changeText = $(cols[2]).find('strong').text().trim();
            const volumeText = $(cols[3]).find('strong').text().trim();
            
            const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
            const change = parseFloat(changeText.replace(/[^0-9.-]/g, ''));
            const volume = parseInt(volumeText.replace(/[^0-9]/g, ''), 10);
            
            // Extract Bursa stock code from link href (e.g. /web/stock/overview/0138 -> 0138)
            const href = $(cols[0]).find('a').attr('href');
            let code = '';
            if (href) {
                const match = href.match(/\/overview\/(\d+)/);
                if (match) {
                    code = match[1];
                }
            }
            
            if (name && !isNaN(price) && !isNaN(volume) && volume > 0) {
                stocks.push({
                    name,
                    price,
                    change: isNaN(change) ? 0 : change,
                    volume,
                    code
                });
            }
        }
    });
    return stocks;
}

async function main() {
    console.log('🚀 Jerung Bursa Scraper v3.1 (Sumber: i3investor)');
    console.log('='.repeat(55));
    
    let allRawStocks = new Map();
    
    // 1. Ambil data pasaran utama
    try {
        console.log('🌐 Menarik data dari klse.i3investor.com...');
        const res = await axios.get('https://klse.i3investor.com/web/market/mostactive', { headers: HEADERS });
        const $ = cheerio.load(res.data);
        
        const activeStocks = parseTab($, '#tab-active');
        const gainerStocks = parseTab($, '#tab-gainers');
        const loserStocks = parseTab($, '#tab-losers');
        
        console.log(`✅ Berjaya menarik: ${activeStocks.length} Aktif, ${gainerStocks.length} Gainer, ${loserStocks.length} Loser.`);
        
        // Gabungkan semua ke dalam Map unik untuk mengelakkan pertindihan data
        [...activeStocks, ...gainerStocks, ...loserStocks].forEach(s => {
            allRawStocks.set(s.name, s);
        });
        
    } catch (e) {
        console.error('❌ Gagal menarik data pasaran:', e.message);
        process.exit(1);
    }
    
    // ==========================================
    // CUSTOM VIP WATCHLIST (YAHOO FINANCE)
    // ==========================================
    const customWatchlist = [
        { symbol: '5357.KL', name: 'SKYECHIP', sector: 'Technology' },
        { symbol: '0275.KL', name: 'OPPSTAR', sector: 'Technology' },
        { symbol: '0453.KL', name: 'EIPOWER', sector: 'Industrial' },
        { symbol: '0457.KL', name: 'PENTECH', sector: 'Industrial' },
        { symbol: '0392.KL', name: 'KEEMING', sector: 'Consumer' },
        { symbol: '0459.KL', name: 'SUM', sector: 'Technology' },
        { symbol: '0396.KL', name: 'ADNEX', sector: 'Technology' },
        { symbol: '0359.KL', name: 'HKB', sector: 'Technology' },
        { symbol: '0391.KL', name: 'AMBEST', sector: 'Consumer' },
        { symbol: '5555.KL', name: 'SUNMED', sector: 'Healthcare' },
        { symbol: '0456.KL', name: 'MMCS', sector: 'Technology' },
        { symbol: '4456.KL', name: 'DNEX', sector: 'Technology' },
        { symbol: '0399.KL', name: 'AMS', sector: 'Industrial' },
        { symbol: '0321.KL', name: 'SDCG', sector: 'Utilities' },
        { symbol: '0325.KL', name: 'NE', sector: 'Technology' },
        { symbol: '0390.KL', name: 'ISF', sector: 'Consumer' },
        { symbol: '0395.KL', name: 'OGX', sector: 'Industrial' },
        { symbol: '0245.KL', name: 'MNHLDG', sector: 'Technology' },
        { symbol: '5328.KL', name: 'LWSABAH', sector: 'Utilities' },
        { symbol: '0339.KL', name: 'CBHB', sector: 'Property' },
        { symbol: '0376.KL', name: 'IAB', sector: 'Consumer' },
        { symbol: '0246.KL', name: 'CNERGEN', sector: 'Technology' },
        { symbol: '0458.KL', name: 'ELSA', sector: 'Technology' },
        { symbol: '9822.KL', name: 'SAM', sector: 'Industrial' },
        { symbol: '5330.KL', name: 'TMK', sector: 'Industrial' },
        { symbol: '0128.KL', name: 'ZETRIX', sector: 'Technology' },
        { symbol: '0270.KL', name: 'NATGATE', sector: 'Technology' },
        { symbol: '7191.KL', name: 'GIIB', sector: 'Industrial' }
    ];

    console.log('\n🔍 Menarik data Custom VIP Watchlist dari Yahoo Finance...');
    for (const s of customWatchlist) {
        try {
            const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${s.symbol}?interval=1d&range=1d`, { headers: HEADERS });
            const meta = res.data.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const prev = meta.chartPreviousClose;
            const change = price - prev;
            const volume = meta.regularMarketVolume || 0;
            
            const code = s.symbol.split('.')[0];
            
            // Hanya tambah jika belum wujud dari i3investor
            if (!allRawStocks.has(s.name)) {
                allRawStocks.set(s.name, {
                    name: s.name,
                    price: price,
                    change: change,
                    volume: volume,
                    isVip: true,
                    sector: s.sector,
                    code: code
                });
                console.log(`   + Tambah ${s.name} (VIP) ke dalam radar (RM ${price.toFixed(3)}).`);
            } else {
                const existing = allRawStocks.get(s.name);
                existing.isVip = true;
                existing.sector = s.sector;
                existing.code = code;
                console.log(`   ~ ${s.name} (VIP) sudah pun berada dalam senarai i3investor.`);
            }
        } catch (e) {
            console.log(`   - Gagal mengambil data untuk ${s.name} (${s.symbol})`);
        }
    }

    // ==========================================
    // YAHOO FINANCE 52W HIGH SCANNER
    // ==========================================
    console.log('\n🔍 Menarik data 52W High dari Yahoo Finance untuk tapisan Pullback...');
    const candidates = [];
    for (const [name, stock] of allRawStocks.entries()) {
        if (name.includes('-')) continue; // Skip warrants
        const turnover = stock.price * stock.volume;
        if (turnover >= 250000 || stock.isVip) {
            candidates.push(stock);
        }
    }

    const yahooPromises = candidates.map(async (stock) => {
        if (!stock.code) return;
        const symbol = `${stock.code}.KL`;
        try {
            const yRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, { headers: HEADERS });
            if (yRes.data && yRes.data.chart && yRes.data.chart.result && yRes.data.chart.result[0]) {
                const result = yRes.data.chart.result[0];
                const timestamp = result.timestamp;
                const quote = result.indicators.quote[0];
                const close = quote.close;
                const low = quote.low;
                const high = quote.high;
                
                const validDays = [];
                for (let i = 0; i < timestamp.length; i++) {
                    if (close[i] !== null && close[i] !== undefined && low[i] !== null && low[i] !== undefined && high[i] !== null && high[i] !== undefined) {
                        validDays.push({
                            close: close[i],
                            low: low[i],
                            high: high[i]
                        });
                    }
                }
                
                if (validDays.length >= 2) {
                    let high52 = 0;
                    validDays.forEach(d => {
                        if (d.high > high52) high52 = d.high;
                    });
                    stock.high52 = high52;
                    
                    const lastDays = validDays.slice(-4);
                    const currentPrice = lastDays[lastDays.length - 1].close;
                    
                    const closes = lastDays.map(d => d.close);
                    const maxClose = Math.max(...closes);
                    const minClose = Math.min(...closes);
                    const closeTightness = ((maxClose - minClose) / minClose) * 100;
                    
                    const lows = lastDays.map(d => d.low);
                    // Tapisan wick harian: Abaikan low yang > 5% di bawah minClose untuk elak outlier
                    const validLows = lows.filter(l => l >= minClose * 0.95);
                    const minLow = validLows.length > 0 ? Math.min(...validLows) : Math.min(...lows);
                    const maxLow = Math.max(...lows);
                    const lowTightness = ((maxLow - minLow) / minLow) * 100;
                    
                    let touchCount = 0;
                    lastDays.forEach(d => {
                        const diffPct = ((d.low - minLow) / minLow) * 100;
                        if (diffPct <= 2.0) {
                            touchCount++;
                        }
                    });
                    
                    const closesDaily = validDays.map(d => d.close).filter(c => c !== null && c !== undefined);
                    const sma50 = closesDaily.length >= 50
                        ? closesDaily.slice(-50).reduce((a, b) => a + b, 0) / 50
                        : (closesDaily.reduce((a, b) => a + b, 0) / closesDaily.length);
                    stock.sma50 = sma50;
                    stock.hasEnoughSmaData = closesDaily.length >= 20;

                    stock.closeTightness = parseFloat(closeTightness.toFixed(2));
                    stock.lowTightness = parseFloat(lowTightness.toFixed(2));
                    stock.touchCount = touchCount;
                    stock.floorLow = minLow;
                    
                    const pullback = ((high52 - currentPrice) / high52) * 100;
                    let isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && (lowTightness <= 4.0 || touchCount >= 2));
                    
                    if (pullback <= 30.0) {
                        try {
                            const intraRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=30m&range=3d`, { headers: HEADERS });
                            if (intraRes.data && intraRes.data.chart && intraRes.data.chart.result && intraRes.data.chart.result[0]) {
                                const intraResult = intraRes.data.chart.result[0];
                                const intraQuote = intraResult.indicators.quote[0];
                                const iClose = intraQuote.close || [];
                                const iLow = intraQuote.low || [];
                                
                                const validCandles = [];
                                for (let j = 0; j < iClose.length; j++) {
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
                                        // (selepas menolak wicks ekor melampau bawah 6%)
                                        stock.floorLow = floorLow;
                                        stock.touchCount = intraTouches;
                                        
                                        if (intraCloseTightness <= 3.8 && intraTouches >= 4) {
                                            isConsolidation = true;
                                            stock.closeTightness = parseFloat(intraCloseTightness.toFixed(2));
                                            stock.isIntradayValidated = true;
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            // Silently ignore or log error
                        }
                    }
                    
                    stock.isConsolidation = isConsolidation;
                }
            }
        } catch (e) {
            console.log(`   - Gagal fetch data sejarah Yahoo untuk ${stock.name} (${symbol}): ${e.message}`);
        }
    });

    await Promise.all(yahooPromises);

    // ==========================================
    // ANALISIS FORMULA SMART MONEY
    // ==========================================
    console.log('\n📊 Menganalisis Formula Smart Money...');
    
    const processedData = [];
    const topGainers = [];
    
    for (const [name, stock] of allRawStocks.entries()) {
        if (name.includes('-')) continue; // Skip all warrants / structured products
        
        const turnover = stock.price * stock.volume;
        // Kira peratus perubahan yang betul: (change / previous_price) * 100
        const previousPrice = stock.price - stock.change;
        const changePct = previousPrice > 0 ? (stock.change / previousPrice) * 100 : 0;
        
        // Tentukan kategori secara dinamik
        let category = 'Intraday / Momentum'; // Default
        if (stock.price < 0.20) {
            category = 'Penny / Spekulatif';
        } else if (stock.price >= 1.50) {
            category = 'Swing / Bluechip';
        }
        
        // Kira pullback jika high52 wujud
        let pullback = null;
        let setupName = 'N/A';
        if (stock.high52) {
            pullback = parseFloat(((stock.high52 - stock.price) / stock.high52 * 100).toFixed(2));
            const isSmaDowntrend = (stock.sma50 && stock.hasEnoughSmaData) ? (stock.price < stock.sma50) : false;
            
            if (isSmaDowntrend || pullback > 30.0) {
                setupName = '🧊 Downtrend / Avoid';
            } else if (pullback <= 5.0) {
                setupName = '🔥 RBS Retest / Near ATH';
            } else if (pullback <= 15.0) {
                setupName = '📉 Healthy Dip';
            } else if (pullback <= 30.0) {
                setupName = '🔻 Buy Support / Deep Pullback';
            }
        }
        
        // Tentukan signal berdasarkan formula
        let signal = 'avoid';
        let reason = 'Jerung Buang / Mendatar';
        
        if (setupName === '🧊 Downtrend / Avoid') {
            signal = 'avoid';
            reason = '🧊 Saham Downtrend: Elak Trading!';
        } else if (stock.isConsolidation) {
            signal = 'buy';
            if (stock.price < 0.20) {
                reason = '⚠️ Penny Goreng: Tapak Tegar (Intraday Sahaja, Elak Hold!)';
            } else if (stock.price >= 1.50) {
                reason = '🔥 Golden Hold: Tapak Tegar Selesa (Sesuai Swing/Hold)';
            } else {
                reason = '🔥 Golden Entry: Tapak Tegar Selesa (Sesuai Swing/Hold)';
            }
        } else if (stock.change > 0 && turnover >= 250000) {
            signal = 'buy';
            if (stock.price < 0.20) {
                reason = '⚠️ Penny Goreng: Pam Volume Laju (Intraday Sahaja, Elak Hold!)';
            } else if (stock.price >= 1.50) {
                if (changePct <= 3.0) {
                    reason = '🔥 Golden Hold: Jerung Mula Kumpul (Sesuai Swing/Hold)';
                } else {
                    reason = '⚡ Momentum Bluechip: Jerung Pam Kuat (Sesuai Swing/Hold)';
                }
            } else { // Mid-cap RM0.20 - RM1.50
                if (changePct <= 3.0) {
                    reason = '🔥 Golden Entry: Jerung Kumpul Selesa (Sesuai Swing/Hold)';
                } else {
                    reason = '⚡ Momentum Kuat: Jerung Mula Pam (Sesuai Intraday/Swing)';
                }
            }
        } else if (stock.isVip && stock.change <= 0) {
            reason = 'VIP Sideway / Pullback (Pantau Peluang)';
        }
        
        // Perkayakan sebab dengan maklumat pullback
        if (stock.high52 && setupName !== '🧊 Downtrend / Avoid') {
            if (pullback <= 5.0) {
                reason += ' (Near ATH)';
            } else if (pullback <= 15.0) {
                reason += ' (Healthy Dip)';
            } else if (pullback <= 30.0) {
                reason += ' (Pullback Support)';
            }
        }
        
        const dataObj = {
            name: stock.name,
            sector: stock.sector || 'Bursa',
            category,
            price: stock.price,
            change: stock.change,
            changePct: parseFloat(changePct.toFixed(2)),
            turnover,
            volume: stock.volume,
            signal,
            reason: stock.isConsolidation ? `🔒 Tapak Tegar (${stock.touchCount}x) | ${reason}` : reason,
            high52: stock.high52 || null,
            pullback: pullback,
            setupName: setupName,
            closeTightness: stock.closeTightness || null,
            lowTightness: stock.lowTightness || null,
            touchCount: stock.touchCount || 0,
            isConsolidation: stock.isConsolidation || false,
            floorLow: stock.floorLow || null
        };
        
        // Top Volume Scan: Simpan semua saham yang mempunyai turnover >= RM 3,000,000 ATAU ianya saham VIP
        if (turnover >= 3_000_000 || stock.isVip) {
            processedData.push(dataObj);
        }
        
        // Top Gainers Scan: Simpan semua saham yang mencatatkan kenaikan peratusan positif
        if (stock.change > 0) {
            topGainers.push({
                name: stock.name,
                price: stock.price,
                changePct: parseFloat(changePct.toFixed(2)),
                volume: stock.volume,
                turnover,
                high52: stock.high52 || null,
                pullback: pullback,
                setupName: setupName
            });
        }
    }
    
    // Susun processedData mengikut turnover tertinggi
    processedData.sort((a, b) => b.turnover - a.turnover);
    
    // Susun topGainers mengikut peratus kenaikan tertinggi
    topGainers.sort((a, b) => b.changePct - a.changePct);
    
    const output = {
        lastUpdated: new Date().toISOString(),
        source: 'klse.i3investor.com',
        topVolume: processedData,
        topGainers: topGainers.slice(0, 20),
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\n🎉 Selesai! ${processedData.length} saham dianalisis.`);
    console.log(`📂 Disimpan ke ${OUTPUT_FILE}`);
    
    // Simpan rekod sejarah (history)
    const dateStr = new Date().toISOString().split('T')[0];
    const histDir = path.join(__dirname, 'history');
    if (!fs.existsSync(histDir)) fs.mkdirSync(histDir);
    fs.writeFileSync(path.join(histDir, `data_${dateStr}.json`), JSON.stringify(output, null, 2));
    
    // Paparan pratonton 5 terbaik
    console.log('\n📋 Top 5 (Turnover):');
    processedData.slice(0, 5).forEach((s, i) => {
        console.log(`  ${i+1}. ${s.name} | RM${s.price.toFixed(3)} | ${s.changePct >= 0 ? '+' : ''}${s.changePct}% | Turnover: RM${(s.turnover/1e6).toFixed(2)}M | ${s.signal.toUpperCase()}`);
    });
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
