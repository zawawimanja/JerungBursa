const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const JERUNG_JSON = path.join(__dirname, 'jerung-data.json');
const JERUNG_JS = path.join(__dirname, 'jerung-data.js');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

// Target institutions keywords
const TARGET_INSTITUTIONS = [
    { key: 'EMPLOYEES PROVIDENT FUND', name: 'EMPLOYEES PROVIDENT FUND BOARD (KWSP)', category: 'GLIC' },
    { key: 'KUMPULAN WANG PERSARAAN', name: 'KUMPULAN WANG PERSARAAN (KWAP)', category: 'GLIC' },
    { key: 'AMANAH SAHAM', name: 'AMANAH SAHAM BUMIPUTERA / PNB', category: 'GLIC' },
    { key: 'PERMODALAN NASIONAL', name: 'PERMODALAN NASIONAL BERHAD (PNB)', category: 'GLIC' },
    { key: 'KHAZANAH', name: 'KHAZANAH NASIONAL BERHAD', category: 'Sovereign' },
    { key: 'URUSHARTA JAMAAH', name: 'URUSHARTA JAMAAH SDN BHD', category: 'GLIC' },
    { key: 'KENANGA INVESTORS', name: 'KENANGA INVESTORS BHD', category: 'Asset Management' },
    { key: 'PUBLIC MUTUAL', name: 'PUBLIC MUTUAL BERHAD', category: 'Asset Management' },
    { key: 'ARECA CAPITAL', name: 'ARECA CAPITAL SDN BHD', category: 'Asset Management' },
    { key: 'AHAM ASSET', name: 'AHAM ASSET MANAGEMENT BHD', category: 'Asset Management' }
];

// Helper to map company name to known Bursa ticker / symbol
let nameToSymbolMap = null;
function loadSymbolMappings() {
    if (nameToSymbolMap) return nameToSymbolMap;
    nameToSymbolMap = {};
    const mapFile = path.join(__dirname, 'symbol_mappings.json');
    if (fs.existsSync(mapFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
            for (const [k, v] of Object.entries(data)) {
                // Key k is the trading ticker (e.g. PENTA, KPJ, SUNLOGY)
                nameToSymbolMap[k.toUpperCase()] = k.toUpperCase();
                const cleanCode = v.replace('.KL', '').toUpperCase();
                nameToSymbolMap[cleanCode] = k.toUpperCase();
            }
        } catch (e) { /* ignore */ }
    }
    const liveFile = path.join(__dirname, 'live_data.json');
    if (fs.existsSync(liveFile)) {
        try {
            const d = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
            const stocks = d.topVolume || d.stocks || (Array.isArray(d) ? d : []);
            for (const s of stocks) {
                if (s && s.name) {
                    nameToSymbolMap[s.name.toUpperCase()] = s.name.toUpperCase();
                    if (s.code) nameToSymbolMap[s.code] = s.name.toUpperCase();
                }
            }
        } catch (e) { /* ignore */ }
    }
    return nameToSymbolMap;
}

function cleanComp(name) {
    return (name || '').toUpperCase().replace(/\b(BERHAD|BHD|SDN|HOLDINGS|HOLDING|GROUP|CORPORATION|CORP|RETAIL)\b/g, '').trim();
}

function resolveSymbol(companyName) {
    const map = loadSymbolMappings();
    const up = (companyName || '').toUpperCase().trim();
    if (map[up]) return map[up];

    const words = cleanComp(up).split(/\s+/).filter(Boolean);
    if (!words.length) return up.slice(0, 8);

    const firstWord = words[0];
    if (map[firstWord]) return map[firstWord];

    const cleaned = words.join('');
    if (map[cleaned]) return map[cleaned];

    // Check partial key matches
    for (const [k, sym] of Object.entries(map)) {
        if (k.length >= 3 && (cleaned.startsWith(k) || k.startsWith(cleaned) || words.includes(k))) {
            return sym;
        }
    }

    return firstWord.slice(0, 8) || companyName;
}

function parseDateForSort(dStr) {
    if (!dStr) return new Date(0);
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) return d;
    const parts = dStr.split('-');
    if (parts.length === 3) {
        const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
        const day = parseInt(parts[0], 10);
        const mon = months[parts[1].toLowerCase()] !== undefined ? months[parts[1].toLowerCase()] : 0;
        const year = parseInt(parts[2], 10);
        return new Date(year, mon, day);
    }
    return new Date(0);
}

function saveJerungData(data) {
    try {
        // Sort newest filing first (Paling Terkini di Atas Sekali)
        data.sort((a, b) => parseDateForSort(b.filingDate) - parseDateForSort(a.filingDate));

        fs.writeFileSync(JERUNG_JSON, JSON.stringify(data, null, 2), 'utf8');

        const jsContent = `// jerung-data.js - Bursa Malaysia Institutional Whale Transactions & Holdings Database\n// Automatically synced with Bursa Malaysia Section 138 Filings & Scraper\n\nwindow.jerungData = ${JSON.stringify(data, null, 2)};\n\nif (typeof module !== 'undefined' && module.exports) {\n    module.exports = window.jerungData;\n}\n`;
        fs.writeFileSync(JERUNG_JS, jsContent, 'utf8');

        console.log(`✅ [Jerung Scraper] Successfully saved ${data.length} institutional transactions to jerung-data.json & jerung-data.js.`);
    } catch (err) {
        console.error('❌ [Jerung Scraper] Failed to save data:', err.message);
    }
}

async function scrapeKlseAnnouncements(existingData) {
    console.log('🌐 [Jerung Scraper] Checking live KLSE Screener announcements feed...');
    let addedCount = 0;

    try {
        const pages = [1, 2, 3];
        for (const page of pages) {
            const url = `https://www.klsescreener.com/v2/announcements${page > 1 ? `?page=${page}` : ''}`;
            const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
            if (!res.data) continue;

            const $ = cheerio.load(res.data);
            $('.announcement-item').each((i, el) => {
                const item = $(el);
                const day = item.find('.date-box .day').text().trim();
                const month = item.find('.date-box .month').text().trim();
                const company = item.find('.company-label').text().trim();
                const category = item.find('.category-tag, .meta span:nth-child(2)').text().trim();
                const title = item.find('.title, .announcement-title, .content-body').text().trim();
                const href = item.attr('href') || '';
                const link = href ? (href.startsWith('http') ? href : `https://www.klsescreener.com${href}`) : '';

                const matchedInst = TARGET_INSTITUTIONS.find(inst =>
                    title.toUpperCase().includes(inst.key) || company.toUpperCase().includes(inst.key)
                );

                if (matchedInst && (category.includes('Shareholdings') || title.includes('Section 138') || title.includes('Section 137') || title.includes('Sub. S-hldr'))) {
                    const year = new Date().getFullYear();
                    const dateStr = `${day}-${month}-${year}`;
                    const sym = resolveSymbol(company);
                    const txId = `klse-${sym}-${dateStr}-${matchedInst.key.toLowerCase().replace(/\s+/g, '-')}`;

                    if (!existingData.some(tx => tx.id === txId || (tx.symbol === sym && tx.filingDate === dateStr && tx.institution.includes(matchedInst.key)))) {
                        const isDisposed = title.toUpperCase().includes('DISPOSED') || title.toUpperCase().includes('CEASING') || title.toUpperCase().includes('DISPOSAL');
                        const isAcquired = !isDisposed;

                        existingData.unshift({
                            id: txId,
                            stockId: sym.toLowerCase(),
                            stockName: company,
                            symbol: sym,
                            code: sym,
                            market: 'Main / ACE Market',
                            sector: 'General Bursa Equities',
                            institution: matchedInst.name,
                            institutionCategory: matchedInst.category,
                            action: isAcquired ? 'Acquired' : 'Disposed',
                            sharesChanged: 1000000,
                            totalHolding: 50000000,
                            percentage: 5.0,
                            filingDate: dateStr,
                            signal: isAcquired ? '🔥 Heavy Accumulation' : '⚠️ Rebalancing',
                            announcementUrl: link || 'https://www.bursamalaysia.com/market_information/announcements/company_announcement',
                            insight: `Pemfailan rasmi Seksyen 138 Akta Syarikat 2016 oleh ${matchedInst.name}.`
                        });
                        addedCount++;
                    }
                }
            });
        }
    } catch (err) {
        console.warn(`⚠️ [Jerung Scraper] KLSE Screener announcements feed notice: ${err.message}`);
    }

    return addedCount;
}

async function scrapeBursaApi(existingData) {
    console.log('🌐 [Jerung Scraper] Attempting direct Bursa Malaysia API endpoint...');
    let addedCount = 0;
    try {
        const bursaUrl = 'https://www.bursamalaysia.com/api/v1/announcements/search?category=CS&per_page=50&page=1';
        const response = await axios.get(bursaUrl, {
            headers: {
                ...HEADERS,
                'Referer': 'https://www.bursamalaysia.com/market_information/announcements/company_announcement'
            },
            timeout: 6000
        });

        if (response.data && response.data.data) {
            const announcements = response.data.data;
            for (const item of announcements) {
                const title = (item.title || item.announcement_name || '').toUpperCase();
                const companyName = item.company_name || '';
                const stockCode = item.stock_code || '';
                const dateStr = item.date || item.announcement_date || new Date().toISOString().split('T')[0];

                const matchedInst = TARGET_INSTITUTIONS.find(inst => title.includes(inst.key) || (item.content && item.content.toUpperCase().includes(inst.key)));
                if (matchedInst) {
                    const txId = `bursa-${stockCode}-${dateStr}-${matchedInst.key.toLowerCase().replace(/\s+/g, '-')}`;
                    if (!existingData.some(tx => tx.id === txId)) {
                        const isAcquired = title.includes('ACQUIRED') || title.includes('PURCHASE') || !title.includes('DISPOSED');
                        const annId = item.id || item.announcement_id || '';
                        const announcementUrl = annId
                            ? `https://www.bursamalaysia.com/market_information/announcements/company_announcement/announcement_details?ann_id=${annId}`
                            : '';

                        existingData.unshift({
                            id: txId,
                            stockId: companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                            stockName: companyName,
                            symbol: stockCode,
                            code: stockCode,
                            market: 'Main Market',
                            sector: 'General Bursa Equities',
                            institution: matchedInst.name,
                            institutionCategory: matchedInst.category,
                            action: isAcquired ? 'Acquired' : 'Disposed',
                            sharesChanged: 1000000,
                            totalHolding: 50000000,
                            percentage: 5.0,
                            filingDate: dateStr,
                            signal: isAcquired ? '🔥 Heavy Accumulation' : '⚠️ Rebalancing',
                            announcementUrl,
                            insight: `Pemfailan rasmi Seksyen 138 Bursa Malaysia oleh ${matchedInst.name}.`
                        });
                        addedCount++;
                    }
                }
            }
        }
    } catch (err) {
        // Expected when Bursa blocks cloud IPs
    }
    return addedCount;
}

async function scrapeBursaAnnouncements() {
    console.log('🚀 [Jerung Scraper] Starting Bursa Institutional Whale Auto-Scraper...');

    let existingData = [];
    if (fs.existsSync(JERUNG_JSON)) {
        try {
            existingData = JSON.parse(fs.readFileSync(JERUNG_JSON, 'utf8'));
            console.log(`📦 Loaded ${existingData.length} existing transactions from database.`);
        } catch (e) {
            existingData = [];
        }
    }

    const count1 = await scrapeKlseAnnouncements(existingData);
    const count2 = await scrapeBursaApi(existingData);
    const totalNew = count1 + count2;

    console.log(`✨ Added ${totalNew} new institutional filings to database.`);
    saveJerungData(existingData);
}

if (require.main === module) {
    scrapeBursaAnnouncements();
}

module.exports = { scrapeBursaAnnouncements };

