(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.JerungLive = api;
})(typeof window === 'object' ? window : globalThis, function () {
    const GITHUB_BASE = 'https://raw.githubusercontent.com/zawawimanja/JerungBursa/main/smart-money-tracker/';
    const DATA_FILES = {
        'fresh_rider_tracker.js': ['FRESH_RIDER_TRACKER', 'ADD_ON_TRACKER', 'FLOOR_ADDON_TRACKER', 'ALL_TRACKER'],
        'hot_theme_tracker.js': ['HOT_THEME_TRACKER', 'HOT_THEME_NEW_TRACKER', 'HOT_THEME_ADDON_TRACKER', 'HOT_THEME_FLOOR_TRACKER', 'HOT_THEME_ALL_TRACKER'],
        'daily_equity_tracker.js': ['DAILY_EQUITY_TRACKER'],
        'scanner_history.js': ['SCANNER_HISTORY'],
        'execution_backtest.js': ['EXECUTION_BACKTEST'],
        'jerung-data.js': ['jerungData'],
        'news_data.js': ['NEWS_DATA']
    };

    async function request(url, fetchImpl = fetch, timeoutMs = 15000) {
        const controller = new AbortController();
        let timer;
        try {
            return await Promise.race([
                fetchImpl(url, { cache: 'no-store', signal: controller.signal }).then(async response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                }),
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new Error('Data request timed out'));
                    }, timeoutMs);
                })
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    function snapshotTime(raw, now = Date.now()) {
        const time = raw && Date.parse(raw.lastUpdated);
        return Number.isFinite(time) && time <= now + 5 * 60000 &&
            Array.isArray(raw.topVolume) && raw.topVolume.some(it => it && it.name && it.price > 0) ? time : 0;
    }

    async function loadSnapshot({ hostedBase = '', previous = null, previousBase = '', fileMode = false, fetchImpl = fetch, now = Date.now() } = {}) {
        const bases = fileMode ? [GITHUB_BASE] : [hostedBase, GITHUB_BASE];
        const results = await Promise.allSettled(bases.map(async base => {
            const raw = JSON.parse(await request(`${base}live_data.json?t=${now}`, fetchImpl));
            if (!snapshotTime(raw, now)) throw new Error('Invalid market snapshot');
            return { raw, base, time: snapshotTime(raw, now), fetched: true };
        }));
        const candidates = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        const previousTime = snapshotTime(previous, now);
        if (previousTime) candidates.push({ raw: previous, base: previousBase, time: previousTime, fetched: false });
        candidates.sort((a, b) => b.time - a.time);
        if (!candidates.length) throw new Error('No valid market snapshot is available');
        // A successful check can return the same timestamp. Never roll back to older data.
        return { ...candidates[0], checked: results.some(r => r.status === 'fulfilled') };
    }

    // Generated assets contain JSON assignments only. Decode the JSON without executing downloaded code.
    function parseDataScript(source, allowedKeys) {
        const data = {};
        let rest = source;
        while (rest.trim()) {
            rest = rest.replace(/^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '');
            if (!rest) break;
            // The whale asset also has an optional CommonJS export for backend readers.
            const exportTail = /^if \(typeof module !== 'undefined' && module\.exports\) \{\s*module\.exports = window\.([A-Za-z_][A-Za-z0-9_]*);\s*\}\s*$/.exec(rest);
            if (exportTail && Object.hasOwn(data, exportTail[1])) break;
            const match = /^window\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*/.exec(rest);
            if (!match || !allowedKeys.includes(match[1]) || Object.hasOwn(data, match[1])) throw new Error('Unexpected data assignment');
            rest = rest.slice(match[0].length);
            if (!['{', '['].includes(rest[0])) throw new Error('Expected JSON data');
            let depth = 0, quoted = false, escaped = false, end = -1;
            for (let i = 0; i < rest.length; i++) {
                const ch = rest[i];
                if (quoted) {
                    if (escaped) escaped = false;
                    else if (ch === '\\') escaped = true;
                    else if (ch === '"') quoted = false;
                } else if (ch === '"') quoted = true;
                else if (ch === '{' || ch === '[') depth++;
                else if (ch === '}' || ch === ']') {
                    depth--;
                    if (!depth) { end = i + 1; break; }
                }
            }
            if (end < 0) throw new Error('Incomplete JSON data');
            data[match[1]] = JSON.parse(rest.slice(0, end));
            rest = rest.slice(end).trimStart();
            if (rest[0] !== ';') throw new Error('Missing assignment separator');
            rest = rest.slice(1);
        }
        if (allowedKeys.some(key => !Object.hasOwn(data, key))) throw new Error('Missing data assignment');
        return data;
    }

    async function loadBundle(base, fetchImpl = fetch, now = Date.now(), files = Object.keys(DATA_FILES)) {
        if (files.some(file => !Object.hasOwn(DATA_FILES, file))) throw new Error('Unknown data file');
        const parts = await Promise.all(files.map(async file =>
            parseDataScript(await request(`${base}${file}?t=${now}`, fetchImpl), DATA_FILES[file])));
        return Object.assign({}, ...parts);
    }

    function freshness(timestamp, now = Date.now()) {
        const myt = new Date(now + 8 * 3600000);
        const minutes = myt.getUTCHours() * 60 + myt.getUTCMinutes();
        const weekday = myt.getUTCDay() >= 1 && myt.getUTCDay() <= 5;
        const updating = weekday && minutes >= 9 * 60 && minutes < 18 * 60 + 15;
        const age = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 60000));
        return { age, delayed: updating && age > 20, updating };
    }

    return { GITHUB_BASE, DATA_FILES, request, snapshotTime, loadSnapshot, parseDataScript, loadBundle, freshness };
});
