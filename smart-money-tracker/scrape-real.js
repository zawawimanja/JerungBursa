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

async function getIpoList() {
    const candidatePaths = [
        path.join(__dirname, '../../ipo/data.json'),
        path.join(__dirname, '../../ipohunterv2/data.json'),
        '/home/awi/Desktop/ipohunterv2/data.json',
        'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json'
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            try {
                console.log(`📂 Loading local IPO database from: ${p}`);
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            } catch (err) {
                console.warn(`⚠️ Failed to parse local IPO database at ${p}:`, err.message);
            }
        }
    }
    // Fallback to fetching online from GitHub if local file is not found (e.g. on GitHub Actions)
    const githubUrl = 'https://raw.githubusercontent.com/zawawimanja/ipobursa/main/data.json';
    try {
        console.log(`🌐 Local IPO database not found. Fetching online from: ${githubUrl}`);
        const res = await axios.get(githubUrl, { headers: HEADERS });
        if (res.status === 200 && Array.isArray(res.data)) {
            console.log(`✅ Loaded ${res.data.length} IPO records from GitHub.`);
            return res.data;
        }
    } catch (err) {
        console.error(`❌ Failed to fetch IPO database from GitHub:`, err.message);
    }
    return [];
}

const freshIpos = [
    'SKYECHIP', 'PENTECH', 'SUM', 'ELSA', 'AMBEST', 'AMS',
    'EIPOWER', 'ISF', 'KEEMING', 'TEAMSTR', 'MMCS', 'GDGROUP',
    'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE'
];

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

async function scrapeBursaMalaysia() {
    console.log('\n🔄 Menggunakan fallback: Menarik data dari bursamalaysia.com via Puppeteer...');
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    try {
        puppeteer.use(StealthPlugin());
    } catch (e) {
        // stealth plugin might already be registered
    }
    
    let browser;
    const stocks = [];
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/google-chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        const modes = ['top_active', 'top_gainers', 'top_losers'];
        for (const mode of modes) {
            console.log(`   - Melawat Bursa Malaysia mode=${mode}...`);
            await page.goto(`https://www.bursamalaysia.com/market_information/equities_prices?mode=${mode}`, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });
            
            await page.waitForSelector('table tbody tr', { timeout: 15000 }).catch(() => {});
            
            const scraped = await page.evaluate(() => {
                const rows = document.querySelectorAll('table tbody tr');
                let list = [];
                rows.forEach(r => {
                    const cols = r.querySelectorAll('td');
                    if (cols.length >= 8) {
                        const nameText = cols[1].innerText.trim();
                        const code = cols[2].innerText.trim();
                        const priceVal = parseFloat(cols[4].innerText.trim().replace(/,/g, ''));
                        const changeVal = parseFloat(cols[6].innerText.trim().replace(/,/g, ''));
                        const volumeVal = parseInt(cols[8].innerText.trim().replace(/,/g, ''), 10) * 100;
                        
                        if (nameText && !isNaN(priceVal) && !isNaN(volumeVal)) {
                            list.push({
                                nameText,
                                code,
                                price: priceVal,
                                change: isNaN(changeVal) ? 0 : changeVal,
                                volume: volumeVal
                            });
                        }
                    }
                });
                return list;
            });
            
            console.log(`     -> Dijumpai ${scraped.length} saham.`);
            scraped.forEach(s => {
                const cleanName = s.nameText.replace(/\s*\[S\]\s*$/, '').trim();
                stocks.push({
                    name: cleanName,
                    price: s.price,
                    change: s.change,
                    volume: s.volume,
                    code: s.code
                });
            });
        }
    } catch (err) {
        console.error('❌ Gagal menarik data dari Bursa Malaysia:', err.message);
    } finally {
        if (browser) await browser.close();
    }
    return stocks;
}

async function pLimit(concurrency, items, fn) {
    const results = [];
    const executing = new Set();
    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

async function main() {
    console.log('🚀 Jerung Bursa Scraper v3.1 (Sumber: i3investor / Fallback: Bursa Malaysia)');
    console.log('='.repeat(55));
    
    // Load IPO database (local or online raw fallback)
    const ipoList = await getIpoList();
    
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
        console.warn('⚠️ Gagal menarik data pasaran dari i3investor:', e.message);
        
        // Fallback ke Bursa Malaysia via Puppeteer
        const fallbackStocks = await scrapeBursaMalaysia();
        if (fallbackStocks.length > 0) {
            console.log(`✅ Berjaya menarik ${fallbackStocks.length} saham dari fallback Bursa Malaysia.`);
            fallbackStocks.forEach(s => {
                allRawStocks.set(s.name, s);
            });
        } else {
            console.error('❌ Tiada data diperolehi dari i3investor dan fallback Bursa Malaysia. Menghentikan scraper.');
            process.exit(1);
        }
    }
    
    // ==========================================
    // CUSTOM VIP WATCHLIST (YAHOO FINANCE)
    // ==========================================
    const rawMappings = JSON.parse(fs.readFileSync(path.join(__dirname, 'symbol_mappings.json'), 'utf8'));
    
    // Deduplicate mappings: if multiple names map to the same symbol, keep only the shortest name (ticker symbol)
    const mappings = {};
    const symToNames = {};
    for (const [name, sym] of Object.entries(rawMappings)) {
        if (!symToNames[sym]) symToNames[sym] = [];
        symToNames[sym].push(name);
    }
    for (const [sym, names] of Object.entries(symToNames)) {
        names.sort((a, b) => a.length - b.length);
        const shortestName = names[0];
        mappings[shortestName] = sym;
    }
    
    // Load sectors from IPO data if available
    const ipoSectors = {};
    if (ipoList && ipoList.length > 0) {
        try {
            ipoList.forEach(ipo => {
                const sym = ipo.symbol ? ipo.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim() : '';
                const name = ipo.companyName ? ipo.companyName.replace(/\[.*?\]/g, '').toUpperCase().trim() : '';
                const sec = ipo.sector ? ipo.sector.split(' ')[0] : 'IPO';
                if (sym) ipoSectors[sym] = sec;
                if (name) ipoSectors[name] = sec;
            });
        } catch (e) {
            // Ignore
        }
    }
    
    // Pre-defined sectors from hardcoded list
    const predefinedSectors = {
        'SKYECHIP': 'Technology', 'OPPSTAR': 'Technology', 'EIPOWER': 'Industrial',
        'PENTECH': 'Industrial', 'KEEMING': 'Consumer', 'SUM': 'Technology',
        'ADNEX': 'Technology', 'HKB': 'Technology', 'AMBEST': 'Consumer',
        'SUNMED': 'Healthcare', 'MMCS': 'Technology', 'DNEX': 'Technology',
        'AMS': 'Industrial', 'SDCG': 'Utilities', 'NE': 'Technology',
        'ISF': 'Consumer', 'OGX': 'Industrial', 'MNHLDG': 'Technology',
        'LWSABAH': 'Utilities', 'CBHB': 'Property', 'IAB': 'Consumer',
        'CNERGEN': 'Technology', 'ELSA': 'Technology', 'SAM': 'Industrial',
        'TMK': 'Industrial', 'ZETRIX': 'Technology', 'NATGATE': 'Technology',
        'GIIB': 'Industrial', 'MCLEAN': 'Industrial', 'EXSIMHB': 'Consumer'
    };
    
    const customWatchlist = Object.entries(mappings).map(([name, symbol]) => {
        let sector = predefinedSectors[name] || ipoSectors[name] || 'Bursa';
        if (sector.includes('(')) sector = sector.split('(')[0].trim();
        const code = symbol.split('.')[0];
        return { symbol, name, sector, code };
    });

    console.log('\n🔍 Mendaftarkan Custom VIP Watchlist dari symbol_mappings.json...');
    for (const s of customWatchlist) {
        // Hanya tambah jika belum wujud dari i3investor / Bursa Malaysia
        if (!allRawStocks.has(s.name)) {
            allRawStocks.set(s.name, {
                name: s.name,
                price: 0,
                change: 0,
                volume: 0,
                isVip: true,
                sector: s.sector,
                code: s.code
            });
        } else {
            const existing = allRawStocks.get(s.name);
            existing.isVip = true;
            existing.sector = s.sector;
            existing.code = s.code;
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
        if (stock.isVip || turnover >= 250000) {
            candidates.push(stock);
        }
    }

    console.log(`⏳ Memulakan imbasan ke atas ${candidates.length} kaunter calon secara selari (concurrency: 10)...`);
    
    await pLimit(10, candidates, async (stock) => {
        if (!stock.code) return;
        const symbol = `${stock.code}.KL`;
        try {
            const yRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, { headers: HEADERS });
            if (yRes.data && yRes.data.chart && yRes.data.chart.result && yRes.data.chart.result[0]) {
                 const result = yRes.data.chart.result[0];
                 const timestamp = result.timestamp || [];
                 const quote = result.indicators.quote[0];
                 const close = quote.close || [];
                 const low = quote.low || [];
                 const high = quote.high || [];
                 const open = quote.open || [];
                 const volumeArr = quote.volume || [];
                 
                 const validDays = [];
                 for (let i = 0; i < timestamp.length; i++) {
                     if (close[i] !== null && close[i] !== undefined && 
                         low[i] !== null && low[i] !== undefined && 
                         high[i] !== null && high[i] !== undefined &&
                         open[i] !== null && open[i] !== undefined) {
                         validDays.push({
                             open: open[i],
                             close: close[i],
                             low: low[i],
                             high: high[i],
                             volume: volumeArr[i] || 0
                         });
                     }
                 }
                
                if (validDays.length >= 2) {
                    let high52 = 0;
                    validDays.forEach(d => {
                        if (d.high > high52) high52 = d.high;
                    });
                    stock.high52 = high52;
                    
                    // Kaunter Sikat (Comb Stock) / Saham Tidur Detection over the last 30 trading days
                    const last30 = validDays.slice(-30);
                    let sumTurnover30 = 0;
                    let flatDays30 = 0;
                    let activeDays30 = 0;

                    last30.forEach(d => {
                        if (d.volume > 0) {
                            activeDays30++;
                            sumTurnover30 += d.close * d.volume;
                            // Round prices to 4 decimal places to fix floating-point comparison inaccuracies from Yahoo Finance
                            const roundedHigh = parseFloat(d.high.toFixed(4));
                            const roundedLow = parseFloat(d.low.toFixed(4));
                            const dailyRangePct = roundedLow > 0 ? ((roundedHigh - roundedLow) / roundedLow) * 100 : 0;

                            // Comb candle: either flat (high === low) OR has extremely narrow range (<= 2% range for penny stocks < 0.50, or <= 1% for others)
                            const isFlatOrPin = (roundedHigh === roundedLow) || (dailyRangePct <= 2.0 && d.close < 0.50) || (dailyRangePct <= 1.0);
                            if (isFlatOrPin) {
                                flatDays30++;
                            }
                        }
                    });

                    const avgTurnover30 = activeDays30 > 0 ? (sumTurnover30 / activeDays30) : 0;
                    const flatPct30 = activeDays30 > 0 ? ((flatDays30 / activeDays30) * 100) : 0;

                    // For fresh IPOs (listed <= 15 days), listing day volume distorts average turnover.
                    // We calculate average turnover using only the last 3 days to get a realistic picture of current liquidity.
                    let realAvgTurnover = avgTurnover30;
                    if (activeDays30 > 0 && activeDays30 <= 15) {
                        const recentDays = last30.slice(-3);
                        const recentSum = recentDays.reduce((acc, curr) => acc + (curr.close * curr.volume), 0);
                        realAvgTurnover = recentSum / Math.min(3, recentDays.length);
                    }

                    // Exclude if average turnover < 400k (sekat saham tidur) OR flat/comb candle percentage >= 15%
                    const isCombStock = (flatPct30 >= 15.0) || (realAvgTurnover < 400000);
                    stock.isCombStock = isCombStock;
                    stock.avgTurnover20 = avgTurnover30;
                    
                    const lastDays = validDays.slice(-4);
                    const lastDay = lastDays[lastDays.length - 1];
                    const prevDay = lastDays[lastDays.length - 2];
                    const currentPrice = lastDay.close;
                    const prevClose = prevDay ? prevDay.close : result.meta.chartPreviousClose || currentPrice;
                    
                    // Kemas kini data harga semasa
                    stock.price = currentPrice;
                    stock.change = currentPrice - prevClose;
                    stock.volume = lastDay.volume || result.meta.regularMarketVolume || 0;
                    
                    const closes = lastDays.map(d => d.close);
                    const maxClose = Math.max(...closes);
                    const minClose = Math.min(...closes);
                    const closeTightness = ((maxClose - minClose) / minClose) * 100;
                    
                    // --- DAILY FLOOR & TOUCHCOUNT LOGIC (TradingView 1D CS Match) ---
                    // We calculate three potential floors: 10-day (standard), 5-day (recent), and 3-day (strong breakout/ATH runner).
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

                    // Hitung Candlestick Rejection dengan syarat ketat (Pinbar / Hammer / Shooting Star)
                    const dailyBody = Math.abs(lastDay.close - lastDay.open);
                    const dailyLowerShadow = Math.min(lastDay.open, lastDay.close) - lastDay.low;
                    const dailyUpperShadow = lastDay.high - Math.max(lastDay.open, lastDay.close);
                    const dailyTotalRange = lastDay.high - lastDay.low;
                    
                    const isDojiConsolidation = (dailyBody / currentPrice <= 0.015) && (floorDist <= 1.5);
                    
                    // Reject Bawah: Ekor bawah mesti sekurang-kurangnya 45% daripada julat harian DAN lebih panjang dari badan lilin
                    const hasLowerWickRejection = (dailyTotalRange > 0 && (
                         (dailyLowerShadow / dailyTotalRange >= 0.45) && 
                         (dailyLowerShadow > dailyBody)
                    )) || isDojiConsolidation;

                    stock.hasLowerWickRejection = hasLowerWickRejection;
                    
                    // Reject Atas: Ekor atas mesti sekurang-kurangnya 45% daripada julat harian DAN lebih panjang dari badan lilin
                    const hasUpperWickRejection = dailyTotalRange > 0 && (
                         (dailyUpperShadow / dailyTotalRange >= 0.45) && 
                         (dailyUpperShadow > dailyBody)
                    );
                    stock.hasUpperWickRejection = hasUpperWickRejection;
                    
                    const closesDaily = validDays.map(d => d.close).filter(c => c !== null && c !== undefined);
                    const sma50 = closesDaily.length >= 50
                        ? closesDaily.slice(-50).reduce((a, b) => a + b, 0) / 50
                        : (closesDaily.reduce((a, b) => a + b, 0) / closesDaily.length);
                    stock.sma50 = sma50;
                    stock.hasEnoughSmaData = closesDaily.length >= 20;

                    const sma200 = closesDaily.length >= 200
                        ? closesDaily.slice(-200).reduce((a, b) => a + b, 0) / 200
                        : (closesDaily.reduce((a, b) => a + b, 0) / closesDaily.length);
                    stock.sma200 = sma200;

                    stock.closeTightness = parseFloat(closeTightness.toFixed(2));
                    stock.lowTightness = parseFloat(lowTightness.toFixed(2));
                    stock.touchCount = touchCount;
                    stock.floorLow = minLow;
                    
                    const pullback = ((high52 - currentPrice) / high52) * 100;
                    // Consolidation: pullback <= 15%, short-term close tightness <= 5.5%, and must have touchCount >= minTouchCountRequired
                    const minTouchCountRequired = (validDays.length < 25 || minLow === floor5) ? 2 : 3;
                    let isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && touchCount >= minTouchCountRequired);
                    stock.isConsolidation = isConsolidation;
                }
            }
        } catch (e) {
            console.log(`   - Gagal fetch data sejarah Yahoo untuk ${stock.name} (${symbol}): ${e.message}`);
        }
    });

    // ==========================================
    // ANALISIS FORMULA SMART MONEY
    // ==========================================
    console.log('\n📊 Menganalisis Formula Smart Money...');
    
    const ipoMap = {};
    try {
        if (ipoList && ipoList.length > 0) {
            ipoList.forEach(ipo => {
                if (ipo.symbol) {
                    const cleanSymbol = ipo.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim();
                    const listingYear = parseInt(ipo.year) || (ipo.listingDate ? parseInt(ipo.listingDate.split('-')[2]) : 0);
                    ipoMap[cleanSymbol] = {
                        grade: ipo.predictedGrade || 'Unrated',
                        year: listingYear,
                        ipoPrice: ipo.price,
                        openPrice: ipo.openPrice,
                        listingDate: ipo.listingDate,
                        os: ipo.os || 0,
                        outlier: ipo.outlier || false
                    };
                }
            });
        }
    } catch (err) {
        console.error("Warning loading IPO grades:", err.message);
    }

    const processedData = [];
    const topGainers = [];
    
    // De-duplicate raw stocks by Yahoo symbol, keeping the one with the shorter name
    const dedupedStocks = new Map();
    for (const [name, stock] of allRawStocks.entries()) {
        if (name.includes('-')) continue;
        const symbol = mappings[name] || name + '.KL';
        if (dedupedStocks.has(symbol)) {
            const existing = dedupedStocks.get(symbol);
            if (name.length < existing.name.length) {
                dedupedStocks.set(symbol, stock);
            }
        } else {
            dedupedStocks.set(symbol, stock);
        }
    }

    for (const stock of dedupedStocks.values()) {
        const name = stock.name;
        // Associate IPO Grade early
        const ipoInfo = ipoMap[name.toUpperCase().trim()];
        if (ipoInfo) {
            stock.ipoGrade = ipoInfo.grade;
            stock.ipoYear = ipoInfo.year;
            stock.ipoPrice = ipoInfo.ipoPrice;
            stock.os = ipoInfo.os || 0;
            stock.outlier = ipoInfo.outlier || false;
        }

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
            const isSma200Downtrend = stock.sma200 ? (stock.price < stock.sma200) : false;
            
            const cleanStockName = stock.name.toUpperCase().trim();
            const isInFreshIpoList = freshIpos.includes(cleanStockName) || freshIpos.some(key => {
                const normKey = key.replace(/[^A-Z0-9]/g, '');
                const normName = cleanStockName.replace(/[^A-Z0-9]/g, '');
                return normName.startsWith(normKey);
            });
            // Fresh IPO definition: has IPO grade, year >= 2025 (listed after 2024) and has no SMA downtrend
            const isFreshIpo = (stock.ipoGrade === 'A' || stock.ipoGrade === 'B' || stock.ipoGrade === 'C') && (stock.ipoYear && stock.ipoYear >= 2025) && !isSmaDowntrend;

            // Logik pintar: Pullback sehingga 40% dibenarkan jika harga di atas SMA200 (Long-term Bullish)
            // Fresh IPO dibenarkan pullback sehingga 55%
            const maxPullbackAllowed = isFreshIpo ? 55.0 : ((!isSma200Downtrend && stock.sma200) ? 40.0 : 30.0);
            
            // Only fresh IPOs are exempt from SMA downtrend filtering to allow initial pullback setup trading
            if ((isSmaDowntrend && !isFreshIpo) || pullback > maxPullbackAllowed) {
                setupName = '🧊 Downtrend / Avoid';
            } else if (pullback <= 5.0) {
                setupName = '🔥 RBS Retest / Near ATH';
            } else if (pullback <= 15.0) {
                setupName = '📉 Healthy Dip';
            } else if (pullback <= 40.0) {
                setupName = '🔻 Buy Support / Deep Pullback';
            } else {
                setupName = '🔻 Premium IPO Deep Pullback';
            }
        }
        
        let setupStyle = 'SWING PLAY';
        if (pullback !== null) {
            if (changePct >= 5.0 || (changePct >= 3.5 && pullback > 5.0)) {
                setupStyle = 'EXPLOSIVE';
            } else if (pullback <= 10.0 && (stock.isConsolidation || stock.lowTightness <= 8.0 || stock.touchCount >= 2)) {
                setupStyle = 'STAIRCASE';
            }
        }
        
        // Determine signal based on formulas
        const distToFloor = stock.floorLow ? (((stock.price - stock.floorLow) / stock.floorLow) * 100) : 0;
        let signal = 'avoid';
        let reason = 'Selling Pressure / Flat';

        if (stock.isCombStock) {
            signal = 'avoid';
            reason = '⚠️ Illiquid / Comb Stock: Unsuitable Chart Pattern (Avoid Trading!)';
        } else if (setupName === '🧊 Downtrend / Avoid') {
            signal = 'avoid';
            reason = '🧊 Downtrend Stock: Avoid Trading!';
        } else if (stock.floorLow && distToFloor > 15.0) {
            signal = 'avoid';
            reason = `⚠️ Overextended: Jauh dari Lantai Sokongan (+${distToFloor.toFixed(1)}% dari floor)`;
        } else if (stock.isConsolidation) {
            if (turnover < 250000) {
                signal = 'avoid';
                reason = '⚠️ Low Liquidity / Comb Stock: Consolidation Base (Avoid Trading!)';
            } else {
                signal = 'buy';
                if (stock.price < 0.20) {
                    reason = '⚠️ Pump & Dump Penny: Consolidation Base (Intraday Only, Avoid Hold!)';
                } else if (stock.price >= 1.50) {
                    reason = '🔥 Golden Hold: Solid Consolidation Base (Suitable for Swing/Hold)';
                } else {
                    reason = '🔥 Golden Entry: Solid Consolidation Base (Suitable for Swing/Hold)';
                }
            }
        } else if (stock.change > 0 && turnover >= 250000) {
            signal = 'buy';
            if (stock.price < 0.20) {
                reason = '⚠️ Pump & Dump Penny: High Volume Pump (Intraday Only, Avoid Hold!)';
            } else if (stock.price >= 1.50) {
                if (changePct <= 3.0) {
                    reason = '🔥 Golden Hold: Smart Money Accumulation (Suitable for Swing/Hold)';
                } else {
                    reason = '⚡ Bluechip Momentum: Institutional Buy Pump (Suitable for Swing/Hold)';
                }
            } else { // Mid-cap RM0.20 - RM1.50
                if (changePct <= 3.0) {
                    reason = '🔥 Golden Entry: Smart Money Accumulating (Suitable for Swing/Hold)';
                } else {
                    reason = '⚡ Strong Momentum: Smart Money Buying (Suitable for Intraday/Swing)';
                }
            }
        } else if (stock.isVip && stock.change <= 0) {
            signal = 'buy';
            reason = 'VIP Sideway / Pullback (Monitor for Opportunities)';
        }
        
        // Perkayakan sebab dengan maklumat pullback
        if (stock.high52 && setupName !== '🧊 Downtrend / Avoid') {
            if (pullback <= 5.0) {
                reason += ' (Near ATH)';
            } else if (pullback <= 15.0) {
                reason += ' (Healthy Dip)';
            } else if (pullback <= 40.0) {
                reason += ' (Pullback Support)';
            }
        }
        
        const dataObj = {
            name: stock.name,
            sector: stock.sector || 'Bursa',
            category,
            setupStyle,
            price: stock.price,
            change: stock.change,
            changePct: parseFloat(changePct.toFixed(2)),
            turnover,
            volume: stock.volume,
            signal,
            reason: stock.isConsolidation ? `🔒 Solid Base (${stock.touchCount}x) | ${reason}` : reason,
            high52: stock.high52 || null,
            pullback: pullback,
            setupName: setupName,
            closeTightness: stock.closeTightness || null,
            lowTightness: stock.lowTightness || null,
            touchCount: stock.touchCount || 0,
            isConsolidation: stock.isConsolidation || false,
            floorLow: stock.floorLow || null,
            hasLowerWickRejection: stock.hasLowerWickRejection || false,
            hasUpperWickRejection: stock.hasUpperWickRejection || false,
            isCombStock: stock.isCombStock || false,
            sma50: stock.sma50 || null,
            sma200: stock.sma200 || null
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
    
    // Helper function to identify comb stocks (saham tidur), illiquid stocks, or downtrend/avoid stocks
    const isSleepingOrAvoidStock = (item) => {
        if (!item) return false;
        if (item.isCombStock) return true;
        
        const setup = (item.setupName || '').toUpperCase();
        if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
        
        const reason = (item.reason || '').toUpperCase();
        if (reason.includes('COMB') || reason.includes('AVOID') || reason.includes('ILLIQUID')) return true;
        
        return false;
    };

    // Tag VVIP (appeared in previous history file and is not a comb/downtrend stock yesterday or today)
    try {
        const histDir = path.join(__dirname, 'history');
        if (fs.existsSync(histDir)) {
            const histFiles = fs.readdirSync(histDir)
                .filter(f => f.startsWith('data_') && f.endsWith('.json'))
                .sort();
            
            const todayStr = new Date().toISOString().split('T')[0];
            const prevFiles = histFiles.filter(f => f < `data_${todayStr}.json`);
            if (prevFiles.length > 0) {
                const prevFile = prevFiles[prevFiles.length - 1];
                const prevFilePath = path.join(histDir, prevFile);
                console.log(`\n🔍 Membandingkan dengan data sejarah semalam: ${prevFile} untuk tagging VVIP...`);
                const prevData = JSON.parse(fs.readFileSync(prevFilePath, 'utf8'));
                const prevTopVolume = prevData.topVolume || [];
                const prevNames = new Set(prevTopVolume.map(item => item.name.toUpperCase()));
                
                let vvipCount = 0;
                processedData.forEach(item => {
                    const name = item.name.toUpperCase();
                    if (prevNames.has(name)) {
                        const yesterdayItem = prevTopVolume.find(x => x.name.toUpperCase() === name);
                        const wasYesterdayBad = isSleepingOrAvoidStock(yesterdayItem);
                        const isTodayBad = isSleepingOrAvoidStock(item);
                        
                        if (!wasYesterdayBad && !isTodayBad) {
                            item.isVvip = true;
                            vvipCount++;
                        }
                    }
                });
                console.log(`✅ Berjaya tag ${vvipCount} kaunter sebagai VVIP (Momentum Aktif Berterusan).`);
            }
        }
    } catch (err) {
        console.error("Warning checking VVIP:", err.message);
    }
    
    // Read IPO Grades from neighboring directory
    try {
        const fallbackIpoMap = {
            '3REN': 'B',
            'HEGROUP': 'B'
        };

        let ipoTagCount = 0;
        processedData.forEach(item => {
            const cleanName = item.name.toUpperCase().trim();
            const info = ipoMap[cleanName];
            if (info) {
                item.ipoGrade = info.grade === 'Unrated' ? (fallbackIpoMap[cleanName] || 'Unrated') : info.grade;
                item.ipoYear = info.year;
                item.ipoPrice = info.ipoPrice;
                item.openPrice = info.openPrice;
                item.listingDate = info.listingDate;
                item.os = info.os || 0;
                item.outlier = info.outlier || false;
                
                // Trend Rider Rule: If Fresh IPO (listed >= 2025) is below its IPO price, it is a failed IPO (avoid!)
                const isFresh = info.year >= 2025;
                if (isFresh && item.ipoPrice && item.price < item.ipoPrice) {
                    item.signal = 'avoid';
                    item.reason = `⚠️ Below IPO Price: Failed IPO Base (Price RM ${item.price.toFixed(3)} < IPO RM ${item.ipoPrice.toFixed(3)})`;
                }
                
                ipoTagCount++;
            }
        });
        console.log(`✅ Berjaya memadankan ${ipoTagCount} kaunter dengan Gred IPO dari projek sebelah.`);
    } catch (err) {
        console.error("Warning loading IPO grades:", err.message);
    }
    
    const output = {
        lastUpdated: new Date().toISOString(),
        source: 'klse.i3investor.com',
        topVolume: processedData,
        topGainers: topGainers.slice(0, 20),
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    fs.writeFileSync(path.join(__dirname, 'live_data.js'), `window.liveData = ${JSON.stringify(output)};`);
    console.log(`\n🎉 Selesai! ${processedData.length} saham dianalisis.`);
    console.log(`📂 Disimpan ke ${OUTPUT_FILE} dan live_data.js`);
    
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
