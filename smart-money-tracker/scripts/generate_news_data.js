const fs = require('fs');
const path = require('path');
const { getCorporateNewsRisk } = require('./fetch_news_module');

const LIVE_DATA_PATH = path.join(path.join(__dirname, '..'), 'live_data.json');
const SYMBOL_MAP_PATH = path.join(path.join(__dirname, '..'), 'symbol_mappings.json');
const OUTPUT_FILE = path.join(path.join(__dirname, '..'), 'news_data.js');

async function pLimit(concurrency, items, fn) {
    const results = [];
    const executing = new Set();
    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);
        if (executing.size >= concurrency) await Promise.race(executing);
    }
    return Promise.all(results);
}

async function generateNewsData() {
    console.log('==================================================');
    console.log('🌐 GENERATING AUTOMATIC CORPORATE NEWS & DIVIDEND DB');
    console.log('==================================================');

    if (!fs.existsSync(LIVE_DATA_PATH)) {
        console.error('❌ live_data.json not found!');
        return;
    }

    const liveData = JSON.parse(fs.readFileSync(LIVE_DATA_PATH, 'utf8'));
    const symbolMap = fs.existsSync(SYMBOL_MAP_PATH) ? JSON.parse(fs.readFileSync(SYMBOL_MAP_PATH, 'utf8')) : {};
    
    // Collect all unique stock candidates from live_data.json, fresh_rider_tracker.js, and hot_theme_tracker.js
    const candidateMap = new Map();
    (liveData.topVolume || []).forEach(s => { if (s && s.name) candidateMap.set(s.name.toUpperCase(), { name: s.name, code: s.code || '' }); });

    const frPath = path.join(__dirname, '..', 'fresh_rider_tracker.js');
    if (fs.existsSync(frPath)) {
        try {
            const content = fs.readFileSync(frPath, 'utf8');
            const matches = content.match(/"name":\s*"([^"]+)"/g) || [];
            matches.forEach(m => {
                const nm = m.replace(/"name":\s*"/, '').replace(/"/, '').trim();
                if (nm && !candidateMap.has(nm.toUpperCase())) candidateMap.set(nm.toUpperCase(), { name: nm, code: '' });
            });
        } catch (e) {}
    }

    const htPath = path.join(__dirname, '..', 'hot_theme_tracker.js');
    if (fs.existsSync(htPath)) {
        try {
            const content = fs.readFileSync(htPath, 'utf8');
            const matches = content.match(/"name":\s*"([^"]+)"/g) || [];
            matches.forEach(m => {
                const nm = m.replace(/"name":\s*"/, '').replace(/"/, '').trim();
                if (nm && !candidateMap.has(nm.toUpperCase())) candidateMap.set(nm.toUpperCase(), { name: nm, code: '' });
            });
        } catch (e) {}
    }

    const candidates = Array.from(candidateMap.values());
    console.log(`📦 Found ${candidates.length} unique stocks to evaluate for corporate news & dividends...`);

    const newsData = {};
    let processedCount = 0;
    let alertCount = 0;

    await pLimit(8, candidates, async (stock) => {
        const nameUpper = stock.name.toUpperCase();
        let code = stock.code || '';
        if (!code && symbolMap[nameUpper]) {
            code = symbolMap[nameUpper].replace(/\.KL$/i, '');
        }

        if (code) {
            try {
                const risk = await getCorporateNewsRisk(code, stock.name);
                if (risk.hasNewsAlert || risk.newsBadges.length > 0 || risk.announcements.length > 0 || risk.entitlements.length > 0) {
                    newsData[nameUpper] = risk;
                    alertCount++;
                }
            } catch (e) {
                // Abaikan ralat kecil
            }
        }
        processedCount++;
        if (processedCount % 50 === 0 || processedCount === candidates.length) {
            console.log(`   Processed ${processedCount}/${candidates.length} stocks... (${alertCount} news risks detected)`);
        }
    });

    const fileContent = `// Auto-generated Corporate News & Ex-Dividend Database
// Generated At: ${new Date().toISOString()}
window.NEWS_DATA = ${JSON.stringify(newsData, null, 2)};
`;

    fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf8');
    console.log(`✅ Successfully generated ${OUTPUT_FILE} with ${Object.keys(newsData).length} stock news records!`);
}

if (require.main === module) {
    generateNewsData().catch(console.error);
}

module.exports = { generateNewsData };
