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
    const githubUrl = 'https://raw.githubusercontent.com/zawawimanja/ipobursa/main/data.json';
    try {
        console.log(`🌐 Attempting to fetch latest IPO database online from: ${githubUrl}`);
        const res = await axios.get(githubUrl, { headers: HEADERS, timeout: 5000 });
        if (res.status === 200 && Array.isArray(res.data)) {
            console.log(`✅ Successfully loaded ${res.data.length} IPO records dynamically from GitHub!`);
            return res.data;
        }
    } catch (err) {
        console.warn(`⚠️ Online fetch failed (${err.message}). Falling back to local database files...`);
    }

    const candidatePaths = [
        path.join(__dirname, '../../ipo/data.json'),
        path.join(__dirname, '../../ipohunterv2/data.json'),
        '/home/awi/Desktop/ipohunterv2/data.json',
        'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json'
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            try {
                console.log(`📂 Loading local fallback IPO database from: ${p}`);
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            } catch (err) {
                console.warn(`⚠️ Failed to parse local IPO database at ${p}:`, err.message);
            }
        }
    }
    return [];
}

const freshIpos = [
    'SKYECHIP', 'PENTECH', 'SUM', 'ELSA', 'AMBEST', 'AMS',
    'EIPOWER', 'ISF', 'KEEMING', 'TEAMSTR', 'MMCS', 'GDGROUP',
    'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE', 'STRATUS'
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
        const launchOptions = {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
        if (process.platform === 'linux') {
            launchOptions.executablePath = '/usr/bin/google-chrome';
        }
        browser = await puppeteer.launch(launchOptions);
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
    
    const ipoMap = {};
    try {
        if (ipoList && ipoList.length > 0) {
            // Simbol yang ada entri sebenar (bukan "[NS]") — entri "[NS]" untuk simbol ini
            // hanya placeholder (tiada gred/OS) dan menimpa entri sebenar (last-wins),
            // cth "RT [NS]" menimpa "RT" (RT Pastry, os 59.96).
            const realSymbols = new Set();
            ipoList.forEach(ipo => {
                if (ipo.symbol && !/\[NS\]/.test(ipo.symbol)) {
                    realSymbols.add(ipo.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim());
                }
            });
            ipoList.forEach(ipo => {
                if (ipo.symbol) {
                    const cleanSymbol = ipo.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim();
                    if (/\[NS\]/.test(ipo.symbol) && realSymbols.has(cleanSymbol)) return;
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
    
    // ==========================================
    // OVERRIDE TEMPATAN: metadata IPO utk kaunter yang tiada/salah dalam DB online (ipobursa)
    // - ADNEX: rekod online ada symbol "NE" yang salah -> tak pernah dipadankan dgn kaunter ADNEX.
    // - EXSIMHB: tiada langsung dalam DB online (bekas Pan Malaysia Holdings, senarai semula 2025).
    // ==========================================
    const LOCAL_IPO_OVERRIDES = {
        'ADNEX': { symbol: 'ADNEX', year: 2026, predictedGrade: 'B', price: 0.20, openPrice: 0.25, listingDate: '17-Mar-2026', os: 3.23, outlier: true },
        'EXSIMHB': { symbol: 'EXSIMHB', year: 2025, predictedGrade: 'B' }
    };
    Object.entries(LOCAL_IPO_OVERRIDES).forEach(([sym, ipo]) => {
        ipoMap[sym] = {
            grade: ipo.predictedGrade || 'Unrated',
            year: ipo.year,
            ipoPrice: ipo.price,
            openPrice: ipo.openPrice,
            listingDate: ipo.listingDate,
            os: ipo.os || 0,
            outlier: ipo.outlier || false
        };
        console.log(`📌 [Override IPO] ${sym}: gred ${ipo.predictedGrade || 'Unrated'}, tahun ${ipo.year}, listing ${ipo.listingDate || 'N/A'}`);
    });
    
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
        names.sort((a, b) => {
            const aIsFresh = freshIpos.includes(a) ? -1 : 1;
            const bIsFresh = freshIpos.includes(b) ? -1 : 1;
            if (aIsFresh !== bIsFresh) return aIsFresh - bIsFresh;
            return a.length - b.length;
        });
        const primaryName = names[0];
        mappings[primaryName] = sym;
    }

    function resolveCodeAndSymbol(name) {
        const cleanName = name.toUpperCase().trim();
        let symbol = rawMappings[cleanName] || mappings[cleanName];
        if (!symbol) {
            const foundKey = Object.keys(rawMappings).find(key => {
                const normKey = key.replace(/[^A-Z0-9]/g, '');
                const normName = cleanName.replace(/[^A-Z0-9]/g, '');
                return normName.startsWith(normKey) || normKey.startsWith(normName);
            });
            if (foundKey) {
                symbol = rawMappings[foundKey];
            }
        }
        if (symbol) {
            const code = symbol.split('.')[0];
            return { symbol, code };
        }
        return { symbol: name + '.KL', code: '' };
    }

    function resolveIpoInfo(cleanName) {
        if (!cleanName) return null;
        const upperName = cleanName.toUpperCase().trim();
        const matches = [];
        
        // 1. Direct match
        if (ipoMap[upperName]) {
            matches.push(ipoMap[upperName]);
        }
        
        // 2. Look for other entries sharing the same Bursa code or having similar normalized names
        const codeA = resolveCodeAndSymbol(upperName).code;
        Object.entries(ipoMap).forEach(([key, val]) => {
            if (key.toUpperCase().trim() === upperName) return; // already added
            const normKey = key.replace(/[^A-Z0-9]/g, '').toUpperCase();
            const normName = upperName.replace(/[^A-Z0-9]/g, '');
            // Elak short ticker (cth "RT") mencuri gred kaunter lain (cth "RTECH" via prefix).
            const minLen = Math.min(normName.length, normKey.length);
            if (minLen >= 4 && (normName.startsWith(normKey) || normKey.startsWith(normName))) {
                matches.push(val);
                return;
            }
            const codeB = resolveCodeAndSymbol(key).code;
            if (codeA && codeB && codeA === codeB) {
                matches.push(val);
            }
        });
        
        if (matches.length === 0) return null;
        
        // Merge matches: prioritize non-Unrated grades, positive OS, and true outliers
        const merged = { ...matches[0] };
        for (let i = 1; i < matches.length; i++) {
            const m = matches[i];
            if ((!merged.grade || merged.grade === 'Unrated') && m.grade && m.grade !== 'Unrated') {
                merged.grade = m.grade;
            }
            if (!merged.os && m.os) {
                merged.os = m.os;
            }
            if (!merged.outlier && m.outlier) {
                merged.outlier = m.outlier;
            }
            if (m.ipoPrice && !merged.ipoPrice) {
                merged.ipoPrice = m.ipoPrice;
            }
            if (m.openPrice && !merged.openPrice) {
                merged.openPrice = m.openPrice;
            }
            // Prefer human listingDate (e.g. '07-Jul-2026') over standard date if available
            if (m.listingDate && (!merged.listingDate || (merged.listingDate.includes('-') && !merged.listingDate.match(/[a-zA-Z]/)))) {
                if (m.listingDate.match(/[a-zA-Z]/)) {
                    merged.listingDate = m.listingDate;
                }
            }
        }
        return merged;
    }

    const dynamicCodeCache = {};
    async function fetchDynamicCode(name) {
        const cleanName = name.replace(/[^A-Z0-9]/g, '').trim().toUpperCase();
        if (dynamicCodeCache[cleanName]) return dynamicCodeCache[cleanName];
        
        try {
            const url = `https://klse.i3investor.com/web/stock/overview/${cleanName}`;
            const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
            const html = res.data;
            const cheerio = require('cheerio');
            const $ = cheerio.load(html);
            
            let code = '';
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const match = href.match(/\/overview\/(\d+)$/);
                    if (match) {
                        code = match[1];
                        return false;
                    }
                }
            });
            
            if (!code) {
                $('script').each((i, el) => {
                    const text = $(el).html();
                    if (text) {
                        const match = text.match(/"stockCode"\s*:\s*"(\d+)"/);
                        if (match) {
                            code = match[1];
                            return false;
                        }
                    }
                });
            }
            
            if (code) {
                // Verify if the page title contains the requested stock symbol name (to avoid matching other trending stocks on false redirects)
                const title = $('title').text().trim().toUpperCase();
                if (!title.includes(cleanName)) {
                    return null;
                }

                const symbol = `${code}.KL`;
                dynamicCodeCache[cleanName] = { symbol, code };
                
                // Auto-append to symbol_mappings.json to avoid repeating lookups
                try {
                    const mappingsPath = path.join(__dirname, 'symbol_mappings.json');
                    const raw = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
                    if (!raw[cleanName]) {
                        raw[cleanName] = symbol;
                        fs.writeFileSync(mappingsPath, JSON.stringify(raw, null, 2), 'utf8');
                        console.log(`   -> [Auto-Mapping] Added new mapping: "${cleanName}": "${symbol}" to symbol_mappings.json`);
                    }
                } catch (err) {
                    console.error("Failed to auto-write mapping:", err.message);
                }
                
                return { symbol, code };
            }
        } catch (e) {
            // Ignored
        }
        return null;
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
        // Cari padanan nama secara fuzzy untuk mengelakkan nama pendua (cth: SRKK vs SRKKAI)
        let existingKey = null;
        if (allRawStocks.has(s.name)) {
            existingKey = s.name;
        } else {
            existingKey = [...allRawStocks.keys()].find(k => {
                const normK = k.replace(/[^A-Z0-9]/g, '').toUpperCase();
                const normS = s.name.replace(/[^A-Z0-9]/g, '').toUpperCase();
                return normK.startsWith(normS) || normS.startsWith(normK);
            });
        }
        
        if (!existingKey) {
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
            const existing = allRawStocks.get(existingKey);
            existing.isVip = true;
            existing.sector = s.sector;
            existing.code = s.code;
        }
    }

    // Auto-register ALL fresh IPOs (listed >= 2025) from data.json to ensure they are never missed!
    // IMPORTANT: Only register LISTED IPOs (stage 5 or has listingDate) — upcoming/draft IPOs (e.g. Big Caring,
    // KK Mart) have no trading data yet and would otherwise produce fake price-0 "buy" signals in the tracker.
    console.log('\n🔍 Mendaftarkan Fresh IPOs (2025-2026) dari data.json (listed sahaja)...');
    const freshIposFromDb = ipoList.filter(ipo => ipo.year >= 2025 && (ipo.stage === 5 || ipo.listingDate));
    for (const ipo of freshIposFromDb) {
        let cleanSym = ipo.symbol ? ipo.symbol.replace(/\[.*?\]/g, '').trim().toUpperCase() : '';
        if (!cleanSym) continue;
        
        let existingKey = null;
        if (allRawStocks.has(cleanSym)) {
            existingKey = cleanSym;
        } else {
            existingKey = [...allRawStocks.keys()].find(k => {
                const normK = k.replace(/[^A-Z0-9]/g, '').toUpperCase();
                const normS = cleanSym.replace(/[^A-Z0-9]/g, '').toUpperCase();
                return normK.startsWith(normS) || normS.startsWith(normK);
            });
        }
        
        let ipoSec = ipo.sector || 'IPO';
        if (ipoSec.includes('(')) ipoSec = ipoSec.split('(')[0].trim();
        
        if (!existingKey) {
            allRawStocks.set(cleanSym, {
                name: cleanSym,
                price: 0,
                change: 0,
                volume: 0,
                isVip: true,
                sector: ipoSec,
                code: '' // To be resolved dynamically
            });
            console.log(`   -> Registered new fresh IPO candidate: ${cleanSym}`);
        } else {
            const existing = allRawStocks.get(existingKey);
            existing.isVip = true;
            if (!existing.sector || existing.sector === 'Bursa') {
                existing.sector = ipoSec;
            }
        }
    }

    // ==========================================
    // YAHOO FINANCE 52W HIGH SCANNER
    // ==========================================
    console.log('\n🔍 Menarik data 52W High dari Yahoo Finance untuk tapisan Pullback...');
    // Resolve any missing codes dynamically using i3investor overview lookup
    for (const [name, stock] of allRawStocks.entries()) {
        if (name.includes('-')) continue; // Skip warrants
        
        // First try the synchronous symbol mappings
        if (!stock.code) {
            const resolved = resolveCodeAndSymbol(stock.name);
            if (resolved.code) {
                stock.code = resolved.code;
            }
        }
        
        // If still no code and it is a fresh IPO/VIP, fetch dynamically!
        if (!stock.code && stock.isVip) {
            console.log(`   -> [Auto-Resolve] Attempting to find Bursa code for fresh candidate: ${stock.name}...`);
            const dynamicResolved = await fetchDynamicCode(stock.name);
            if (dynamicResolved && dynamicResolved.code) {
                stock.code = dynamicResolved.code;
                console.log(`   -> [Auto-Resolve] Successfully mapped ${stock.name} to ${dynamicResolved.code}`);
            } else {
                console.log(`   -> [Auto-Resolve] Failed to map ${stock.name}. Skipping Yahoo fetch.`);
            }
        }
    }

    const candidates = [];
    for (const [name, stock] of allRawStocks.entries()) {
        if (name.includes('-')) continue; // Skip warrants
        const turnover = stock.price * stock.volume;
        if (stock.code && (stock.isVip || turnover >= 250000)) {
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
                
                if (validDays.length >= 1) {
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

                    // ==========================================
                    // IMPROVEMENT 1: VOLUME SPIKE FILTER
                    // ==========================================
                    // Kira purata volume 20 hari lepas (tidak termasuk hari ini)
                    const last20Days = validDays.slice(-21, -1); // 20 hari sebelum hari ini
                    const avgVolume20 = last20Days.length > 0
                        ? last20Days.reduce((sum, d) => sum + (d.volume || 0), 0) / last20Days.length
                        : 0;
                    // Volume spike ratio: berapa kali ganda volume hari ini berbanding purata
                    const volumeSpike = (avgVolume20 > 0 && stock.volume > 0)
                        ? parseFloat((stock.volume / avgVolume20).toFixed(2))
                        : 0;
                    // hasVolumeSpike = true jika volume hari ini >= 1.5x purata (jejak masuk Smart Money)
                    const hasVolumeSpike = volumeSpike >= 1.5;
                    stock.avgVolume20 = Math.round(avgVolume20);
                    stock.volumeSpike = volumeSpike;
                    stock.hasVolumeSpike = hasVolumeSpike;

                    // ==========================================
                    // MULTI-PERIOD VCP CONTRACTION ANALYSIS
                    // Teknik Mamat: Detect aktif pengecilan julat harga
                    // (5 hari terkini MESTI lebih ketat dari 20 hari lepas)
                    // ==========================================
                    const vcpPeriod20 = validDays.slice(-20);
                    const vcpPeriod5  = validDays.slice(-5);
                    const vcpCloses20 = vcpPeriod20.map(d => d.close);
                    const vcpCloses5  = vcpPeriod5.map(d => d.close);

                    const vcpTightness20 = vcpCloses20.length >= 10
                        ? ((Math.max(...vcpCloses20) - Math.min(...vcpCloses20)) / Math.min(...vcpCloses20)) * 100
                        : null;
                    const vcpTightness5 = vcpCloses5.length >= 3
                        ? ((Math.max(...vcpCloses5) - Math.min(...vcpCloses5)) / Math.min(...vcpCloses5)) * 100
                        : null;

                    // isContracting = true jika 5d range sekurang-kurangnya 30% lebih ketat dari 20d range
                    // (hallmark utama VCP: volatiliti menguncup secara progresif)
                    const isContracting = (vcpTightness20 !== null && vcpTightness5 !== null)
                        ? (vcpTightness5 < vcpTightness20 * 0.70)
                        : false;

                    // Volume declining during consolidation (quiet accumulation, bukan breakout)
                    const avg5Vol = vcpPeriod5.reduce((s, d) => s + (d.volume || 0), 0) / Math.max(vcpPeriod5.length, 1);
                    const volumeDecline = avgVolume20 > 0 ? (avg5Vol < avgVolume20 * 0.85) : false;

                    stock.vcpTightness20 = vcpTightness20 !== null ? parseFloat(vcpTightness20.toFixed(2)) : null;
                    stock.vcpTightness5  = vcpTightness5  !== null ? parseFloat(vcpTightness5.toFixed(2))  : null;
                    stock.isContracting  = isContracting;
                    stock.volumeDecline  = volumeDecline;

                    // Resolve openPrice and check wentUnderwater status
                    const cleanStockName = stock.name.toUpperCase().trim();
                    let ipoInfo = resolveIpoInfo(cleanStockName);
                    let openPrice = (ipoInfo && ipoInfo.openPrice) || (validDays[0] ? validDays[0].open : null);
                    // Fallback for Yahoo Finance bug on listing day (where open is returned as 0)
                    if ((openPrice === null || openPrice === 0 || openPrice === undefined) && validDays[0]) {
                        if (validDays[0].open > 0) {
                            openPrice = validDays[0].open;
                        } else if (validDays[0].high > 0 && validDays[0].low > 0) {
                            openPrice = (validDays[0].high + validDays[0].low) / 2;
                        }
                    }
                    let wentUnderwater = false;
                    if (openPrice && openPrice > 0) {
                        wentUnderwater = validDays.some(d => d.low < openPrice);
                    }
                    stock.openPrice = openPrice;
                    stock.wentUnderwater = wentUnderwater;
                    if (validDays.length > 0) {
                        stock.firstDayOpenPrice = validDays[0].open || openPrice;
                    }
                    
                    const closes = lastDays.map(d => d.close);
                    const maxClose = Math.max(...closes);
                    const minClose = Math.min(...closes);
                    const closeTightness = ((maxClose - minClose) / minClose) * 100;
                    
                    // --- DAILY FLOOR & TOUCHCOUNT LOGIC (TradingView 1D CS Match) ---
                    // We calculate three potential floors: 40-day (full accumulation), 20-day (recent), and 10-day (short-term)
                    // Extended to 40 days to capture 2-month accumulation bases like SKYECHIP at RM2.91
                    const pullbackValForFloor = high52 ? (((high52 - currentPrice) / high52) * 100) : 0;
                    
                    const lookback40 = Math.min(40, validDays.length);
                    const dailyLookback40 = validDays.slice(-lookback40);
                    const lows40 = dailyLookback40.map(d => d.low);
                    const floor40 = Math.min(...lows40);
                    const dist40 = ((currentPrice - floor40) / floor40) * 100;
                    
                    let touch40 = 0;
                    dailyLookback40.forEach(d => {
                        if (((d.low - floor40) / floor40) * 100 <= 2.0) touch40++;
                    });

                    const lookback10 = Math.min(20, validDays.length);
                    const dailyLookback10 = validDays.slice(-lookback10);
                    const lows10 = dailyLookback10.map(d => d.low);
                    const floor10 = Math.min(...lows10);
                    const dist10 = ((currentPrice - floor10) / floor10) * 100;
                    
                    let touch10 = 0;
                    dailyLookback10.forEach(d => {
                        if (((d.low - floor10) / floor10) * 100 <= 2.0) touch10++;
                    });
                    
                    const lookback5 = Math.min(10, validDays.length);
                    const dailyLookback5 = validDays.slice(-lookback5);
                    const lows5 = dailyLookback5.map(d => d.low);
                    const floor5 = Math.min(...lows5);
                    const dist5 = ((currentPrice - floor5) / floor5) * 100;
                    
                    let touch5 = 0;
                    dailyLookback40.forEach(d => {
                        if (Math.abs(((d.low - floor5) / floor5) * 100) <= 2.0) touch5++;
                    });

                    const lookback3 = Math.min(3, validDays.length);
                    const dailyLookback3 = validDays.slice(-lookback3);
                    const lows3 = dailyLookback3.map(d => d.low);
                    const floor3 = Math.min(...lows3);

                    // Determine which floor to use: prefer the highest (most recent) stable floor cluster
                    let minLow = floor40;
                    let touchCount = touch40;
                    
                    // If recent 10-day floor is significantly higher (newer higher base), use it
                    if (floor10 >= floor40 * 1.02) {
                        minLow = floor10;
                        let t10 = 0;
                        dailyLookback40.forEach(d => {
                            if (Math.abs(((d.low - floor10) / floor10) * 100) <= 2.5) t10++;
                        });
                        touchCount = Math.max(t10, touch10);
                    }
                    // If even more recent floor5 is higher still, use it
                    if (floor5 >= minLow * 1.02) {
                        minLow = floor5;
                        let t5 = 0;
                        dailyLookback40.forEach(d => {
                            if (Math.abs(((d.low - floor5) / floor5) * 100) <= 2.5) t5++;
                        });
                        touchCount = Math.max(t5, touch5);
                    }
                    
                    const floorDist = ((currentPrice - minLow) / minLow) * 100;
                    const maxLow = Math.max(...lows10);
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

                    // ==========================================
                    // TEKNIK MAMAT: EMA25 + EMA50 (Pullback Entry)
                    // ==========================================
                    // Formula EMA: EMA_today = price * k + EMA_prev * (1-k), k = 2/(period+1)
                    function calcEMA(closes, period) {
                        if (closes.length === 0) return null;
                        const k = 2 / (period + 1);
                        let ema = closes[0]; // seed dengan harga pertama
                        for (let i = 1; i < closes.length; i++) {
                            ema = closes[i] * k + ema * (1 - k);
                        }
                        return parseFloat(ema.toFixed(4));
                    }

                    const ema25 = closesDaily.length >= 10 ? calcEMA(closesDaily, 25) : null;
                    const ema50 = closesDaily.length >= 10 ? calcEMA(closesDaily, 50) : null;
                    stock.ema25 = ema25;
                    stock.ema50 = ema50;

                    // EMA25 di atas EMA50 = trend jangka pendek sihat (Pullback Entry valid)
                    stock.ema25AboveEma50 = (ema25 !== null && ema50 !== null) ? ema25 > ema50 : false;

                    // Harga dekat/sentuh EMA25 = zona pullback entry padu
                    // Definisi: harga dalam julat -3% hingga +5% dari EMA25
                    stock.nearEma25 = (ema25 !== null && currentPrice > 0)
                        ? (currentPrice >= ema25 * 0.97 && currentPrice <= ema25 * 1.05)
                        : false;

                    // ==========================================
                    // TEKNIK MAMAT: MA50/200 GOLDEN CROSS (Trend & VCP)
                    // ==========================================
                    // Golden Cross = MA50 baru lepas cross atas MA200 (dalam 50 hari terakhir)
                    // Cara detect: SMA50 > SMA200 sekarang, tapi pada suatu titik dalam 50 hari lepas ia masih bawah
                    let isGoldenCross = false;
                    let goldenCrossAge = null; // berapa hari lepas cross berlaku
                    if (closesDaily.length >= 55 && sma50 > sma200) {
                        // Semak 50 titik sejarah untuk cari bila cross berlaku
                        const lookbackGC = Math.min(50, closesDaily.length - 50);
                        for (let gi = 1; gi <= lookbackGC; gi++) {
                            const pastCloses = closesDaily.slice(0, closesDaily.length - gi);
                            const pastSma50 = pastCloses.length >= 50
                                ? pastCloses.slice(-50).reduce((a, b) => a + b, 0) / 50
                                : null;
                            const pastSma200 = pastCloses.length >= 200
                                ? pastCloses.slice(-200).reduce((a, b) => a + b, 0) / 200
                                : null;
                            if (pastSma50 !== null && pastSma200 !== null && pastSma50 <= pastSma200) {
                                isGoldenCross = true;
                                goldenCrossAge = gi; // cross berlaku gi hari yang lepas
                                break;
                            }
                        }
                    }
                    stock.isGoldenCross = isGoldenCross;
                    stock.goldenCrossAge = goldenCrossAge; // null = tiada cross / cross lama

                    stock.closeTightness = parseFloat(closeTightness.toFixed(2));
                    stock.lowTightness = parseFloat(lowTightness.toFixed(2));
                    stock.touchCount = touchCount;
                    stock.floorLow = minLow;
                    
                    const pullback = ((high52 - currentPrice) / high52) * 100;
                    // Consolidation: pullback <= 15%, short-term close tightness <= 5.5%, and must have touchCount >= minTouchCountRequired
                    const minTouchCountRequired = (validDays.length < 25 || minLow === floor5) ? 2 : 3;
                    let isConsolidation = (pullback <= 15.0 && closeTightness <= 5.5 && touchCount >= minTouchCountRequired);
                    stock.isConsolidation = isConsolidation;

                    // Teknik Mamat: VCP Contraction Stage (C1, C2, C3)
                    // Berdasarkan DARJAH penguncupan progresif (bukan sekadar jarak ke lantai)
                    const distToMinLow = ((currentPrice - minLow) / minLow) * 100;
                    let vcpStage = null;
                    if (pullback >= 3.0 && pullback <= 22.0 && isContracting) {
                        const t5 = stock.vcpTightness5;
                        const t20 = stock.vcpTightness20;
                        if (t5 !== null && t5 <= 3.5 && distToMinLow <= 3.5 && touchCount >= 3) {
                            vcpStage = 'C3'; // Micro-contraction terakhir: ideal pre-breakout entry!
                        } else if (t5 !== null && t5 <= 6.0 && distToMinLow <= 5.0 && touchCount >= 2) {
                            vcpStage = 'C2'; // Pengecilan kedua: tapak semakin matang
                        } else if (pullback >= 4.0) {
                            vcpStage = 'C1'; // Binaan tapak pertama
                        }
                    }
                    stock.vcpStage = vcpStage;
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

    const processedData = [];
    const topGainers = [];
    
    // De-duplicate raw stocks by Yahoo symbol, keeping the active one, or the one with shorter name if both active/inactive.
    const dedupedStocks = new Map();
    for (const [name, stock] of allRawStocks.entries()) {
        if (name.includes('-')) continue;
        const symbol = resolveCodeAndSymbol(name).symbol;
        if (dedupedStocks.has(symbol)) {
            const existing = dedupedStocks.get(symbol);
            const incomingActive = stock.price > 0 || stock.volume > 0;
            const existingActive = existing.price > 0 || existing.volume > 0;
            
            if (incomingActive && !existingActive) {
                if (existing.isVip) stock.isVip = true;
                dedupedStocks.set(symbol, stock);
            } else if (!incomingActive && existingActive) {
                if (stock.isVip) existing.isVip = true;
            } else {
                if (name.length < existing.name.length) {
                    if (existing.isVip) stock.isVip = true;
                    dedupedStocks.set(symbol, stock);
                } else {
                    if (stock.isVip) existing.isVip = true;
                }
            }
        } else {
            dedupedStocks.set(symbol, stock);
        }
    }

    for (const stock of dedupedStocks.values()) {
        const name = stock.name;
        // Associate IPO Grade early using fuzzy match
        let ipoInfo = resolveIpoInfo(name);
        if (ipoInfo) {
            stock.ipoGrade = ipoInfo.grade;
            stock.ipoYear = ipoInfo.year;
            stock.ipoPrice = ipoInfo.ipoPrice;
            stock.os = ipoInfo.os || 0;
            stock.outlier = ipoInfo.outlier || false;
            // Attach listingDate AWAL supaya ipoAge (dikira di bawah) guna tarikh sebenar,
            // bukan fallback 1-Jan (yang selalu bagi ipoAge = 228 hari untuk semua IPO 2026).
            stock.listingDate = ipoInfo.listingDate;
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
            const floorP = stock.floorLow || (stock.price * 0.95);
            const distToFloorP = stock.price > 0 ? (((stock.price - floorP) / floorP) * 100) : 0;
            if (changePct >= 5.0 || (changePct >= 3.5 && pullback > 5.0)) {
                setupStyle = 'EXPLOSIVE';
            } else if (
                pullback >= 4.0 &&           // Mesti dah tarik balik dari high (bukan AT ATH / post-breakout)
                pullback <= 22.0 &&           // Bukan deep pullback yang terlalu jauh
                stock.isContracting &&        // WAJIB: volatiliti sedang menguncup secara progresif (ciri VCP)
                distToFloorP <= 5.0 &&        // Rapat di atas lantai sokongan
                changePct < 3.0 &&            // Tiada breakout hari ini
                !stock.hasVolumeSpike &&      // Volume senyap (bukan breakout volume)
                stock.touchCount >= 3 &&      // Lantai sokongan kukuh (3+ sentuhan)
                stock.price > (stock.sma50 || 0) // Uptrend context: harga di atas SMA50
            ) {
                setupStyle = 'STAIRCASE';
            }
        }

        // ==========================================
        // IMPROVEMENT 2: STAIRCASE + IPO AGE COMBO
        // ==========================================
        // Kira umur IPO dalam hari dari tarikh listing
        let ipoAge = null;
        if (stock.ipoYear) {
            // Gunakan listingDate jika ada, fallback ke 1 Jan tahun IPO
            let listingTs = null;
            if (stock.listingDate) {
                const parsedDate = new Date(stock.listingDate);
                if (!isNaN(parsedDate.getTime())) listingTs = parsedDate;
            }
            if (!listingTs) {
                listingTs = new Date(`${stock.ipoYear}-01-01`);
            }
            const today = new Date();
            ipoAge = Math.floor((today - listingTs) / (1000 * 60 * 60 * 24)); // dalam hari
        }
        // Fresh IPO: listed dalam <= 3 tahun (1095 hari) dan bukan downtrend
        const isIpoFreshForCombo = ipoAge !== null && ipoAge <= 1095 && setupName !== '🧊 Downtrend / Avoid';
        const isStaircaseIpo = setupStyle === 'STAIRCASE' && isIpoFreshForCombo;
        // Upgrade setupStyle jika STAIRCASE + Fresh IPO combo
        if (isStaircaseIpo) {
            setupStyle = 'STAIRCASE + IPO';
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
        } else if (stock.floorLow && distToFloor > 25.0) {
            signal = 'avoid';
            reason = `⚠️ Overextended: Jauh dari Lantai Sokongan (+${distToFloor.toFixed(1)}% dari floor)`;
        } else if (stock.isConsolidation || (stock.touchCount >= 2 && distToFloor <= 10.0)) {
            if (turnover < 150000) {
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
        } else if ((stock.change >= 0 || stock.touchCount >= 2 || stock.isVip) && turnover >= 150000) {
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
        } else if (stock.isVip) {
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

        // ==========================================
        // IMPROVEMENT 3: CONFIDENCE SCORE v2 (0-100)
        // Data-driven berdasarkan backtest 134 trades sebenar
        // ==========================================
        let confScore = 0;

        // ── A) SETUP STYLE ──────────────────────────────────────────
        // Backtest: STAIRCASE avg +6.4% (42% win), SWING +5.7% (41%), EXPLOSIVE +4.3% (36%)
        // STAIRCASE+IPO adalah setup terbaik dari segi potensi breakout
        if (setupStyle === 'STAIRCASE + IPO') confScore += 32;
        else if (setupStyle === 'STAIRCASE')   confScore += 25;
        else if (setupStyle === 'SWING PLAY')  confScore += 12;
        else if (setupStyle === 'EXPLOSIVE')   confScore += 8; // Sering terlambat masuk

        // ── B) VOLUME SPIKE — PREDICTOR #1 ─────────────────────────
        // MMCS +34.6%, HKB +36.4%, ECA +29.4% semua ada volume spike sebelum naik
        // Ini adalah jejak PALING PENTING yang Jerung/Smart Money tinggalkan
        if (stock.hasVolumeSpike && stock.volumeSpike >= 3.0) confScore += 25; // 3x+ = Jerung masuk besar
        else if (stock.hasVolumeSpike && stock.volumeSpike >= 2.0) confScore += 20; // 2x = Significant
        else if (stock.hasVolumeSpike) confScore += 14; // 1.5x-2x = Early accumulation

        // ── C) FLOOR SOLIDITY (touchCount) ─────────────────────────
        // Dikurangkan dari formula lama — touchCount tinggi TIDAK CUKUP jika tiada momentum
        // SDCG (score lama 19, touchCount tinggi) = miss berturut-turut
        if (stock.touchCount >= 8) confScore += 12; // Solid floor tapi jangan terlalu yakin
        else if (stock.touchCount >= 4) confScore += 8;
        else if (stock.touchCount >= 2) confScore += 4;

        // ── D) TREND ALIGNMENT (SMA) ────────────────────────────────
        // SMA adalah penapis downtrend — MESTI di atas kedua-dua untuk pengesahan trend
        const aboveSma50  = stock.sma50  && stock.price > stock.sma50;
        const aboveSma200 = stock.sma200 && stock.price > stock.sma200;
        if (aboveSma50 && aboveSma200) confScore += 12; // Trend uptrend sepenuhnya
        else if (aboveSma50)           confScore += 5;  // Uptrend jangka pendek sahaja
        // Jika di bawah SMA50 → PENALTI (saham dalam tekanan jual)
        if (stock.sma50 && stock.hasEnoughSmaData && stock.price < stock.sma50) confScore -= 10;

        // ── D2) TEKNIK MAMAT: EMA25/50 PULLBACK ENTRY ──────────────
        // EMA25 > EMA50 = trend jangka pendek sihat
        // Harga dekat EMA25 = zona pullback entry yang tepat (risiko rendah)
        if (stock.ema25AboveEma50 && stock.nearEma25) {
            confScore += 15; // COMBO: Pullback ke EMA25 dalam uptrend = setup paling ideal
        } else if (stock.ema25AboveEma50) {
            confScore += 7;  // Trend EMA baik tapi belum pullback ke EMA25
        } else if (stock.nearEma25) {
            confScore += 3;  // Dekat EMA25 tapi trend EMA lemah
        }

        // ── D3) TEKNIK MAMAT: MA50/200 GOLDEN CROSS (VCP Trend) ────
        // Golden Cross = MA50 baru cross atas MA200 = permulaan trend baru yang paling kuat
        // Makin muda cross, makin banyak "runway" untuk VCP setup
        if (stock.isGoldenCross && stock.goldenCrossAge !== null) {
            if (stock.goldenCrossAge <= 10) confScore += 20;      // Cross baru (< 2 minggu) = SANGAT FRESH
            else if (stock.goldenCrossAge <= 30) confScore += 15; // Cross kurang sebulan = Fresh
            else if (stock.goldenCrossAge <= 50) confScore += 10; // Cross dalam 2 bulan = Masih valid
        } else if (aboveSma50 && aboveSma200 && !stock.isGoldenCross) {
            confScore += 3; // Dah lama di atas kedua-dua MA = stabil tapi bukan fresh cross
        }

        // ── E) IPO FRESHNESS ────────────────────────────────────────
        // Fresh IPO tiada overhead resistance = lebih mudah breakout ke ATH baru
        if (stock.ipoYear >= 2025) confScore += 10; // Ultra fresh < 2 tahun
        else if (stock.ipoYear >= 2023) confScore += 6; // Fresh < 4 tahun

        // ── F) ENTRY TIGHTNESS (jarak dari floor) ──────────────────
        // Semakin dekat floor = risk lebih kecil, Stop Loss lebih ketat
        if (distToFloor <= 2.0)      confScore += 12; // Ultra tight: SL < 3%
        else if (distToFloor <= 4.0) confScore += 8;  // Tight: SL < 5%
        else if (distToFloor > 10.0) confScore -= 8;  // PENALTI: terlalu jauh dari floor

        // ── G) SIGNAL & MOMENTUM ───────────────────────────────────
        if (signal === 'buy') confScore += 5;
        if (stock.isConsolidation)       confScore += 5; // Sedang membina tapak
        if (stock.hasLowerWickRejection) confScore += 5; // Penolakan harga pada sokongan
        // Momentum positif hari ini = lebih kuat
        if (changePct > 0 && changePct <= 5.0) confScore += 4;  // Naik sihat
        if (changePct > 5.0) confScore -= 3; // Terlambat masuk jika sudah meletup

        // ── H) NEAR ATH ─────────────────────────────────────────────
        if (pullback !== null && pullback <= 5.0)  confScore += 8; // RBS / Near ATH runner
        else if (pullback !== null && pullback <= 10.0) confScore += 4;

        // ── I) TURNOVER SWEET SPOT ──────────────────────────────────
        // Data backtest: Turnover <3M avg +6.6% vs Turnover >3M avg +5.0%
        // Sweet spot: cukup liquid tapi belum terlalu ramai yang tahu
        if (turnover >= 500000 && turnover < 3000000) confScore += 6;
        else if (turnover >= 3000000) confScore += 2; // Dah viral = sering terlambat

        // ── J) PENALTI AVOID SIGNAL ────────────────────────────────
        if (signal === 'avoid') confScore -= 20;

        // Cap pada 0-100
        const confidenceScore = Math.min(100, Math.max(0, confScore));

        // Tier Label
        let confidenceTier = '❌ AVOID';
        if (confidenceScore >= 90) confidenceTier = '🔥🔥 ULTRA STRONG';
        else if (confidenceScore >= 75) confidenceTier = '🔥 STRONG';
        else if (confidenceScore >= 60) confidenceTier = '✅ MODERATE';
        else if (confidenceScore >= 40) confidenceTier = '⚠️ WEAK';

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
            vcpStage: stock.vcpStage || null,
            vcpTightness20: stock.vcpTightness20 || null,
            vcpTightness5: stock.vcpTightness5 || null,
            isContracting: stock.isContracting || false,
            volumeDecline: stock.volumeDecline || false,
            floorLow: stock.floorLow || null,
            hasLowerWickRejection: stock.hasLowerWickRejection || false,
            hasUpperWickRejection: stock.hasUpperWickRejection || false,
            isCombStock: stock.isCombStock || false,
            sma50: stock.sma50 || null,
            sma200: stock.sma200 || null,
            openPrice: stock.openPrice || null,
            wentUnderwater: stock.wentUnderwater || false,
            firstDayOpenPrice: stock.firstDayOpenPrice || null,
            // Improvement 1: Volume Spike
            avgVolume20: stock.avgVolume20 || 0,
            volumeSpike: stock.volumeSpike || 0,
            hasVolumeSpike: stock.hasVolumeSpike || false,
            // Improvement 2: STAIRCASE + IPO Age
            ipoAge: ipoAge,
            isStaircaseIpo: isStaircaseIpo || false,
            // Improvement 3: Confidence Score
            confidenceScore,
            confidenceTier,
            // Teknik Mamat: EMA25/50 Pullback Entry + MA50/200 Golden Cross VCP
            ema25: stock.ema25 || null,
            ema50: stock.ema50 || null,
            ema25AboveEma50: stock.ema25AboveEma50 || false,
            nearEma25: stock.nearEma25 || false,
            isGoldenCross: stock.isGoldenCross || false,
            goldenCrossAge: stock.goldenCrossAge || null
        };
        
        // Top Volume Scan: Simpan semua saham yang mempunyai turnover >= RM 3,000,000 ATAU ianya saham VIP
        if (turnover >= 3_000_000 || stock.isVip) {
            processedData.push(dataObj);
        }
        
        // Top Gainers Scan: Simpan saham yang naik — tapis kaunter illiquid
        // (harga < RM0.10 atau turnover < RM100k) supaya senarai setanding
        // KLSE Screener — kaunter-kacang 1-2 sen yang "naik 100%" tak boleh trade.
        if (stock.change > 0 && stock.price >= 0.10 && turnover >= 100000) {
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
    
    // Susun processedData mengikut Confidence Score tertinggi, kemudian Turnover sebagai tiebreaker
    processedData.sort((a, b) => {
        if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
        return b.turnover - a.turnover;
    });
    
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
            let info = resolveIpoInfo(cleanName);
            if (info) {
                item.ipoGrade = info.grade === 'Unrated' ? (fallbackIpoMap[cleanName] || 'Unrated') : info.grade;
                item.ipoYear = info.year;
                item.ipoPrice = info.ipoPrice;
                item.openPrice = info.openPrice || item.openPrice || item.firstDayOpenPrice;
                item.listingDate = info.listingDate;
                item.os = info.os || 0;
                item.outlier = info.outlier || false;
                
                // Trend Rider Rule: If Fresh IPO (listed >= 2025) is below its IPO price, it is a failed IPO (avoid!)
                const isFresh = info.year >= 2025;
                if (isFresh && item.ipoPrice && item.price > 0 && item.price < item.ipoPrice) {
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
    
    // Final safety net: drop stocks with no price data (unlisted, suspended or unresolvable).
    // They have no trading data, so any signal generated for them is meaningless.
    const cleanData = processedData.filter(item => item.price && item.price > 0);
    const droppedCount = processedData.length - cleanData.length;
    if (droppedCount > 0) console.log(`⚠️ Membuang ${droppedCount} kaunter tanpa harga (price 0) — tiada data dagangan sahih.`);

    const output = {
        lastUpdated: new Date().toISOString(),
        source: 'klse.i3investor.com',
        topVolume: cleanData,
        topGainers: topGainers.slice(0, 20),
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    fs.writeFileSync(path.join(__dirname, 'live_data.js'), `window.liveData = ${JSON.stringify(output)};`);
    console.log(`\n🎉 Selesai! ${processedData.length} saham dianalisis.`);
    console.log(`📂 Disimpan ke ${OUTPUT_FILE} dan live_data.js`);
    
    // Simpan rekod sejarah (history)
    // Guard: skip pada hujung minggu MYT — run manual Sabtu/Ahad baca candle yang belum finalize
    // (cth. Yahoo masih pulangkan candle Khamis pada 1:42am Sabtu) dan MENINDIH data tutup Jumaat yang betul,
    // menyebabkan entry tracker direkod pada tarikh salah. live_data tetap dikemas kini.
    const mytWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short' }).format(new Date());
    if (mytWeekday === 'Sat' || mytWeekday === 'Sun') {
        console.log('🌙 Hujung minggu (MYT) — rekod sejarah diskip (elak data stale menindih hari dagangan).');
    } else {
        const dateStr = new Date().toISOString().split('T')[0];
        const histDir = path.join(__dirname, 'history');
        if (!fs.existsSync(histDir)) fs.mkdirSync(histDir);
        fs.writeFileSync(path.join(histDir, `data_${dateStr}.json`), JSON.stringify(output, null, 2));
    }
    
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
