const fs = require('fs');
const path = require('path');
const { parseDataScript, DATA_FILES } = require('../live-refresh');
const { getCorporateNewsRisk, buildCorporateNewsRisk, normalizeAnnouncements, parseEventDate } = require('./fetch_news_module');

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

function collectCandidates(liveData, dataDir) {
    const candidates = new Map();
    const add = stock => {
        if (!stock || typeof stock.name !== 'string' || !stock.name.trim()) return;
        const name = stock.name.trim();
        const key = name.toUpperCase();
        const previous = candidates.get(key);
        candidates.set(key, { name, code: stock.code || (previous && previous.code) || '' });
    };
    (liveData.topVolume || []).forEach(add);
    (liveData.topGainers || []).forEach(add);
    const visit = value => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) value.forEach(visit);
        else {
            add(value);
            Object.values(value).forEach(visit);
        }
    };
    for (const file of ['fresh_rider_tracker.js', 'hot_theme_tracker.js']) {
        const filename = path.join(dataDir, file);
        if (fs.existsSync(filename)) visit(parseDataScript(fs.readFileSync(filename, 'utf8'), DATA_FILES[file]));
    }
    return Array.from(candidates.values());
}

function rebuildNewsCache(previous, reference = new Date(), sourceReference = reference) {
    return Object.fromEntries(Object.entries(previous).map(([name, risk]) => {
        const lastSuccessfulAt = {
            announcements: risk.lastSuccessfulAt && Object.hasOwn(risk.lastSuccessfulAt, 'announcements') ? risk.lastSuccessfulAt.announcements : new Date(sourceReference).toISOString(),
            entitlements: risk.lastSuccessfulAt && Object.hasOwn(risk.lastSuccessfulAt, 'entitlements') ? risk.lastSuccessfulAt.entitlements : new Date(sourceReference).toISOString()
        };
        const announcements = normalizeAnnouncements(risk.announcements, lastSuccessfulAt.announcements || sourceReference, { descending: true });
        const entitlements = (Array.isArray(risk.entitlements) ? risk.entitlements : []).filter(ent => ent && parseEventDate(ent.exDate, lastSuccessfulAt.entitlements || sourceReference)).map(ent => ({
            ...ent, exDate: parseEventDate(ent.exDate, lastSuccessfulAt.entitlements || sourceReference).toISOString().slice(0, 10)
        }));
        return [name, { ...risk, ...buildCorporateNewsRisk(announcements, entitlements, reference), lastSuccessfulAt }];
    }));
}

function readPreviousNews(filename, reference = new Date()) {
    if (!fs.existsSync(filename)) return {};
    const source = fs.readFileSync(filename, 'utf8');
    const previous = parseDataScript(source, ['NEWS_DATA']).NEWS_DATA;
    const generatedAt = (source.match(/^\/\/ Generated At:\s*(\S+)/m) || [])[1];
    const sourceReference = generatedAt && Number.isFinite(Date.parse(generatedAt)) ? generatedAt : reference;
    return rebuildNewsCache(previous, reference, sourceReference);
}

async function generateNewsData({ dataDir = path.join(__dirname, '..'), fetchRisk = getCorporateNewsRisk, reference = new Date(), logger = console, cachedOnly = false, clock = () => new Date() } = {}) {
    const liveDataPath = path.join(dataDir, 'live_data.json');
    const symbolMapPath = path.join(dataDir, 'symbol_mappings.json');
    const outputFile = path.join(dataDir, 'news_data.js');
    const checkedAt = new Date(reference).toISOString();
    logger.log('🌐 Generating corporate news and dividend database...');
    if (!cachedOnly && !fs.existsSync(liveDataPath)) throw new Error('live_data.json not found');

    const liveData = !cachedOnly ? JSON.parse(fs.readFileSync(liveDataPath, 'utf8')) : {};
    const symbolMap = fs.existsSync(symbolMapPath) ? JSON.parse(fs.readFileSync(symbolMapPath, 'utf8')) : {};
    const previous = readPreviousNews(outputFile, reference);
    const newsData = { ...previous };
    const observations = {};
    const candidates = cachedOnly ? [] : collectCandidates(liveData, dataDir);
    const fetchesByCode = new Map();
    let failures = 0;
    logger.log(`📦 Evaluating ${candidates.length} unique stocks...`);

    await pLimit(8, candidates, async stock => {
        const name = stock.name.toUpperCase();
        const cached = previous[name] || {};
        const code = String(stock.code || symbolMap[name] || '').replace(/\.KL$/i, '').trim();
        let risk;
        try {
            if (!code) throw new Error('Stock code unavailable');
            if (!fetchesByCode.has(code)) fetchesByCode.set(code, Promise.resolve().then(() => fetchRisk(code, stock.name, { reference })));
            risk = await fetchesByCode.get(code);
            if (!risk || !Array.isArray(risk.announcements) || !Array.isArray(risk.entitlements)) throw new Error('Invalid news result');
        } catch (error) {
            risk = { announcements: [], entitlements: [], fetchStatus: { announcements: 'error', entitlements: 'error' } };
        }
        const status = risk.fetchStatus || { announcements: 'ok', entitlements: 'ok' };
        const announcements = status.announcements === 'ok' ? risk.announcements : (cached.announcements || []);
        const entitlements = status.entitlements === 'ok' ? risk.entitlements : (cached.entitlements || []);
        if (status.announcements !== 'ok' || status.entitlements !== 'ok') failures++;
        const merged = buildCorporateNewsRisk(announcements, entitlements, reference);
        const receivedAt = new Date(clock()).toISOString();
        merged.fetchStatus = status;
        merged.checkedAt = receivedAt;
        merged.lastSuccessfulAt = {
            announcements: status.announcements === 'ok' ? receivedAt : (cached.lastSuccessfulAt && cached.lastSuccessfulAt.announcements || null),
            entitlements: status.entitlements === 'ok' ? receivedAt : (cached.lastSuccessfulAt && cached.lastSuccessfulAt.entitlements || null)
        };
        observations[name] = merged;
        // Keep failures explicit, even without a cache: an unavailable feed is not an empty successful feed.
        if (merged.announcements.length || merged.entitlements.length || status.announcements !== 'ok' || status.entitlements !== 'ok') newsData[name] = merged;
        else delete newsData[name];
    });

    const sorted = Object.fromEntries(Object.entries(newsData).sort(([a], [b]) => a.localeCompare(b)));
    const content = `// Auto-generated Corporate News & Ex-Dividend Database\n// Generated At: ${checkedAt}\nwindow.NEWS_DATA = ${JSON.stringify(sorted, null, 2)};\n`;
    const temporary = outputFile + '.tmp';
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, outputFile);
    if (!cachedOnly) {
        const { getMytDate } = require('./lib/bursa_calendar');
        const historyDir = path.join(dataDir, 'history');
        fs.mkdirSync(historyDir, { recursive: true });
        const completedAt = new Date(clock()).toISOString();
        const envelope = { schemaVersion: 1, recordedAt: completedAt, snapshotTimestamp: liveData.lastUpdated,
            source: 'KLSE Screener', records: observations };
        const stamp = completedAt.replace(/[:.]/g, '-');
        fs.writeFileSync(path.join(historyDir, `news_${getMytDate(completedAt)}_${stamp}.json`), JSON.stringify(envelope));
    }
    if (failures) logger.warn(`⚠️ ${failures} stocks had unavailable feeds; cached source records were preserved.`);
    logger.log(`✅ Saved ${Object.keys(sorted).length} corporate news records.`);
    return sorted;
}

if (require.main === module) {
    generateNewsData({ cachedOnly: process.argv.includes('--cached') }).catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { generateNewsData, collectCandidates, readPreviousNews, rebuildNewsCache };
