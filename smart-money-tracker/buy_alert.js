// =============================================================
// BUY ALERT 4:30 PM — JerungBursa Smart Money Tracker
// -------------------------------------------------------------
// Jalankan waktu pasaran (cth. 4:30 petang MYT) untuk dapatkan
// senarai "saham patut beli" SEBELUM market tutup 5:00 petang.
//
// 1. Baca live_data.json (semua indikator sedia ada)
// 2. Fetch harga LIVE dari Yahoo Finance (bar hari ini, intraday)
// 3. Kemas kini medan harga-driven (price, change, volumeSpike,
//    pullback, closeTightness, floorDist)
//    — kalau harga lari jauh dari snapshot (high52/floor stale,
//      cth. SAM), refresh semula dari Yahoo range=1y
// 4. Guna rule SAMA macam generator/site (FR + HT) utk cari
//    siapa qualify HARI INI
// 5. Tandai 🆕 BARU / 🟢 RE-ENTRY (scan 30 hari history)
// 6. Semak posisi OPEN tracker yang bawah trailing stop (⚠️ SL)
// 7. Hantar mesej ke Telegram (jika TELEGRAM_BOT_TOKEN ada)
//
// Guna: node buy_alert.js
// Env:  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (opsional — kalau
//       tiada, mesej dicetak ke console & ditulis buy_alert_latest.json)
// =============================================================
const fs = require('fs');
const path = require('path');
const https = require('https');

const HIST_DIR = path.join(__dirname, 'history');

// -------------------------------------------------------------
// Load .env tempatan (jika wujud) — tanpa dependency tambahan.
// Env var sedia ada (cth. dari GitHub Actions) DIUTAMAKAN.
// -------------------------------------------------------------
function loadEnvFile() {
    try {
        const f = path.join(__dirname, '.env');
        if (!fs.existsSync(f)) return;
        for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    } catch (e) { /* abaikan */ }
}
loadEnvFile();

// -------------------------------------------------------------
// HTTP helpers (elak dependency — guna https asli)
// -------------------------------------------------------------
function getText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (r) => {
            let s = '';
            r.on('data', d => s += d);
            r.on('end', () => resolve(s));
        }).on('error', reject);
    });
}
function getJson(url) {
    return getText(url).then(s => JSON.parse(s));
}

// -------------------------------------------------------------
// Kanonikalkan nama stok (sama macam generator)
// -------------------------------------------------------------
const SYM_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'symbol_mappings.json'), 'utf8'));
const symNames = {};
for (const [nm, sym] of Object.entries(SYM_MAP)) {
    if (!symNames[sym]) symNames[sym] = [];
    symNames[sym].push(nm);
}
const canonByName = {};
for (const [sym, nms] of Object.entries(symNames)) {
    nms.sort((a, b) => a.length - b.length);
    const canon = nms[0];
    for (const nm of nms) canonByName[nm.toUpperCase()] = canon;
}
function canonName(name) {
    const up = (name || '').toUpperCase().trim();
    return canonByName[up] || name;
}
function resolveSymbol(name) {
    const up = (name || '').toUpperCase().trim();
    return SYM_MAP[up] || null;
}
// Resolve simbol Yahoo dinamik dari i3investor (sama macam scrape-real.js)
const dynamicCodeCache = {};
async function fetchDynamicCode(name) {
    const cleanName = (name || '').replace(/[^A-Z0-9]/g, '').trim().toUpperCase();
    if (!cleanName) return null;
    if (dynamicCodeCache[cleanName]) return dynamicCodeCache[cleanName];
    try {
        const html = await getText(`https://klse.i3investor.com/web/stock/overview/${cleanName}`);
        const codeMatch = html.match(/\/overview\/(\d+)/);
        const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
        if (codeMatch && title.toUpperCase().includes(cleanName)) {
            const symbol = codeMatch[1] + '.KL';
            dynamicCodeCache[cleanName] = symbol;
            return symbol;
        }
    } catch (e) { /* abaikan */ }
    return null;
}

// -------------------------------------------------------------
// HOT THEME mapping + strategy filters (port dari
// generate_hot_theme_tracker.js — SAMA dengan index.html)
// -------------------------------------------------------------
const HOT_THEME_MAP = {
    'Semiconductor': ['UNISEM','MI','VITROX','PENTA','UWC','KGB','NATGATE','FRONTKN','GREATEC','ELSOFT','ATE','PENTECH','KEEMING','HKB','ADNEX','ICENTS','AMS','MINOX','IFCAMSC','TEAMSTR','FAMIERA','SUMI','CRPMATE','PMIBHD','ECOMATE','ATECH','RAMSSOL','TOPMIX','SEMICO','MISC'],
    'Solar/RE': ['SLVEST','JSSOLAR','VERDANT','SAM','GENERGY','SAMAIDEN','NE']
};
function getHotThemes(name) {
    const n = (name || '').toUpperCase();
    const hits = [];
    for (const [theme, list] of Object.entries(HOT_THEME_MAP)) {
        if (list.some(s => n.includes(s) || s.includes(n))) hits.push(theme);
    }
    return hits;
}

function isFreshIpo(item) {
    if (!item) return false;
    if (item.ipoAge != null && item.ipoAge <= 730) return true;
    if (item.ipoYear != null && item.ipoYear >= 2024) return true;
    if (item.listingDate) { const m = String(item.listingDate).match(/\d{4}/); if (m && parseInt(m[0]) >= 2024) return true; }
    return false;
}
function isSleepingOrAvoidStock(item) {
    if (!item) return false;
    if (item.signal === 'avoid') return true;
    if (item.isCombStock) return true;
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('OVEREXTENDED') || reason.includes('ILLIQUID')) return true;
    if (isFreshIpo(item)) return false;
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
    if (reason.includes('COMB') || reason.includes('AVOID')) return true;
    return false;
}
function passesJerungRadar(item) {
    if (!item || !item.price || item.price <= 0 || item.price > 10.0) return false;
    if (isSleepingOrAvoidStock(item) || item.isCombStock || item.signal === 'avoid') return false;
    const changeVal = item.changePct !== undefined ? item.changePct : item.change;
    if (changeVal > 5.0) return false;
    const pullback = item.pullback; if (pullback == null) return false;
    const closeTight = typeof item.closeTightness === 'number' ? item.closeTightness : 99;
    const touches = item.touchCount || 0;
    const isNearAthPath = pullback <= 15.0;
    const isSecondaryBasePath = pullback > 15.0 && pullback <= 30.0 && closeTight <= 5.0 && touches >= 5 && changeVal < 3.0 && (item.sma50 ? item.price >= item.sma50 : true);
    if (!isNearAthPath && !isSecondaryBasePath) return false;
    if (isNearAthPath && item.sma50 && item.price < item.sma50) return false;
    if ((item.turnover || 0) < 300000) return false;
    if (isNearAthPath && touches < 2) return false;
    const t1 = isNearAthPath && !item.hasVolumeSpike && item.isConsolidation === true && touches >= 3 && closeTight <= 5.0;
    const t2 = isNearAthPath && item.hasVolumeSpike && (item.volumeSpike || 0) < 3.0 && changeVal < 3.5 && closeTight <= 10.0;
    return t1 || t2 || isSecondaryBasePath;
}
function passesVcpStaircase(item) {
    if (!item || !item.price || item.price <= 0 || item.price > 10.0) return false;
    if (isSleepingOrAvoidStock(item) || item.isCombStock || item.signal === 'avoid') return false;
    if (item.sma50 && item.price < item.sma50) return false;
    const pb = item.pullback ?? 99; if (pb > 25.0) return false;
    if (!item.isConsolidation && (item.touchCount || 0) < 3) return false;
    return true;
}
function passesTrendRiders(item) {
    if (!item || !item.price || item.price <= 0 || item.price > 10.0) return false;
    if (isSleepingOrAvoidStock(item) || item.isCombStock || item.signal === 'avoid') return false;
    if (item.sma50 && item.price < item.sma50) return false;
    if ((item.turnover || 0) < 300000) return false;
    return true;
}
function passesEarlySpring(item) {
    if (!item || !item.openPrice || item.openPrice <= 0) return false;
    if (isSleepingOrAvoidStock(item) || item.isCombStock || item.signal === 'avoid') return false;
    const dist = ((item.price - item.openPrice) / item.openPrice) * 100;
    return dist >= 0 && dist <= 5.0 && item.price <= 10.0;
}
function passesBottomFishing(item) {
    if (!item || !item.price || item.price <= 0 || item.price > 10.0) return false;
    if (isSleepingOrAvoidStock(item) || item.isCombStock || item.signal === 'avoid') return false;
    const pb = item.pullback ?? 0;
    const distFloor = item.floorLow ? ((item.price - item.floorLow) / item.floorLow * 100) : 99;
    return pb >= 35.0 && (item.touchCount || 0) >= 3 && distFloor <= 5.0;
}
const STRATS = [passesJerungRadar, passesVcpStaircase, passesTrendRiders, passesEarlySpring, passesBottomFishing];
function confluenceCount(item) {
    if (item.price > 10.0) return 0;
    if (isSleepingOrAvoidStock(item) || item.isCombStock) return 0;
    return STRATS.reduce((c, fn) => c + (fn(item) ? 1 : 0), 0);
}

// CS MERAH = squeeze ON (volum senyap) — entry style. CS HIJAU = breakout.
function isCSMerah(item) {
    return !(item && item.hasVolumeSpike === true && (item.volumeSpike || 0) >= 1.5);
}

// ---- Rule Fresh VVIP Rider (A5) — sama macam generator/site ----
function isFreshRiderPick(item) {
    return item.isVvip === true && item.signal !== 'avoid' && !item.isCombStock
        && (item.ipoYear || 0) >= 2025 && (item.pullback ?? 99) <= 10 && (item.closeTightness ?? 99) <= 5.0
        && item.price >= 0.10 && item.price <= 50
        && isCSMerah(item);
}

// ---- Rule Hot Theme (confluence 2+ + tema) ----
function isHotThemePick(item) {
    if (!item || !item.name || item.price <= 0 || item.price > 10.0) return false;
    if (isSleepingOrAvoidStock(item) || item.isCombStock) return false;
    if (getHotThemes(item.name).length === 0) return false;
    if (!isCSMerah(item)) return false;
    return confluenceCount(item) >= 2;
}

// -------------------------------------------------------------
// Kemas kini medan harga-driven dari bar Yahoo terbaru
// -------------------------------------------------------------
function applyYahooBar(item, bars, prevClose) {
    if (!bars || bars.length === 0) return false;
    const last = bars[bars.length - 1];
    if (last.close == null || last.close <= 0) return false;

    item.price = +(+last.close).toFixed(4);
    if (prevClose && prevClose > 0) {
        item.change = +(item.price - prevClose).toFixed(4);
        item.changePct = +(((item.price - prevClose) / prevClose) * 100).toFixed(2);
    }
    item.volume = last.volume || 0;
    item.turnover = +(item.price * item.volume).toFixed(0);

    // Volume spike vs purata 20 hari
    const vols = bars.map(b => b.volume || 0);
    const avgVol20 = vols.length >= 2 ? vols.slice(0, -1).reduce((a, b) => a + b, 0) / (vols.length - 1) : 0;
    item.volumeSpike = avgVol20 > 0 ? +((item.volume / avgVol20).toFixed(2)) : 0;
    item.hasVolumeSpike = item.volumeSpike >= 1.5;

    // Pullback dari 52W high
    if (item.high52) item.pullback = +(((item.high52 - item.price) / item.high52) * 100).toFixed(2);

    // Close tightness (4 hari terakhir, hari ini = harga live)
    const closes = bars.map(b => b.close).filter(c => c != null && c > 0);
    const last4 = closes.slice(-4);
    if (last4.length >= 3) {
        const mx = Math.max(...last4), mn = Math.min(...last4);
        item.closeTightness = +(((mx - mn) / mn) * 100).toFixed(2);
    }

    // Jarak ke lantai (floor)
    if (item.floorLow && item.floorLow > 0) item.floorDist = +(((item.price - item.floorLow) / item.floorLow) * 100).toFixed(2);

    return true;
}

// Refresh struktur harian (high52, floor, touchCount) dari Yahoo range=1y
// — untuk kaunter yang snapshot live_data-nya stale (harga lari jauh
//   dari high52/floor, cth. SAM: price 4.41 vs high52 lama 1.73).
async function refreshYearly(item, symbol) {
    try {
        const r = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`);
        const res = r.chart && r.chart.result && r.chart.result[0];
        if (!res) return false;
        const ts = res.timestamp || [];
        const q = res.indicators.quote[0];
        const bars = [];
        for (let i = 0; i < ts.length; i++) {
            if (q.close[i] == null || q.close[i] <= 0) continue;
            bars.push({ open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] || 0 });
        }
        if (bars.length < 5) return false;

        const highs = bars.map(b => b.high).filter(h => h != null && h > 0);
        if (highs.length) item.high52 = Math.max(...highs);
        if (item.high52) item.pullback = +(((item.high52 - item.price) / item.high52) * 100).toFixed(2);

        // Floor = min low 40 hari terakhir; touch = hari low dalam 2% floor
        const last40 = bars.slice(-40);
        const lows40 = last40.map(b => b.low).filter(l => l != null && l > 0);
        if (lows40.length) {
            const floor = Math.min(...lows40);
            item.floorLow = floor;
            item.floorDist = +(((item.price - floor) / floor) * 100).toFixed(2);
            item.touchCount = last40.filter(b => b.low != null && (((b.low - floor) / floor) * 100) <= 2.0).length;
        }

        const closes = bars.map(b => b.close).filter(c => c != null && c > 0);
        const last4 = closes.slice(-4);
        if (last4.length >= 3) {
            const mx = Math.max(...last4), mn = Math.min(...last4);
            item.closeTightness = +(((mx - mn) / mn) * 100).toFixed(2);
        }
        const touches = item.touchCount || 0;
        const minTouch = bars.length < 25 ? 2 : 3;
        item.isConsolidation = (item.pullback ?? 99) <= 15.0 && (item.closeTightness ?? 99) <= 5.5 && touches >= minTouch;
        return true;
    } catch (e) { return false; }
}

// -------------------------------------------------------------
// Fetch Yahoo 1 bulan (bar harian; bar terakhir = harga live hari ini)
// -------------------------------------------------------------
async function fetchYahoo(symbol) {
    try {
        const r = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`);
        const res = r.chart && r.chart.result && r.chart.result[0];
        if (!res) return null;
        const meta = res.meta || {};
        const ts = res.timestamp || [];
        const q = res.indicators.quote[0];
        const bars = [];
        for (let i = 0; i < ts.length; i++) {
            if (q.close[i] == null || q.close[i] <= 0) continue;
            bars.push({
                date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
                open: q.open[i], high: q.high[i], low: q.low[i],
                close: q.close[i], volume: q.volume[i] || 0
            });
        }
        // Masa last trade sebenar (meta.regularMarketTime) — penting utk
        // sahkan harga yang digunakan betul-betul waktu 4:30 petang.
        const dataTime = (meta.regularMarketTime || (ts.length ? ts[ts.length - 1] : 0)) * 1000;
        return { bars, dataTime };
    } catch (e) { return null; }
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
        if (executing.size >= concurrency) await Promise.race(executing);
    }
    return Promise.all(results);
}

// -------------------------------------------------------------
// Load tracker file (window.X = {...}; — buang comment & prefix)
// -------------------------------------------------------------
function loadTrackerTrades(file) {
    try {
        let raw = fs.readFileSync(file, 'utf8');
        raw = raw.replace(/^\/\/[^\n]*\n/g, '');
        const start = raw.indexOf('=');
        if (start < 0) return [];
        const obj = JSON.parse(raw.slice(start + 1).replace(/;\s*$/, '').trim());
        return (obj && Array.isArray(obj.trades)) ? obj.trades : [];
    } catch (e) { return []; }
}

// -------------------------------------------------------------
// Scan 30 hari history — nama yang qualify sebelum hari ini
// (untuk badge 🆕 BARU / 🟢 RE-ENTRY)
// -------------------------------------------------------------
function loadHistoryDay(dateStr) {
    const f = path.join(HIST_DIR, `data_${dateStr}.json`);
    if (!fs.existsSync(f)) return [];
    try {
        const d = JSON.parse(fs.readFileSync(f, 'utf8'));
        return Array.isArray(d) ? d : (d.topVolume || []);
    } catch (e) { return []; }
}

function isTradingDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    const wd = d.getDay();
    return wd !== 0 && wd !== 6;
}

// -------------------------------------------------------------
// Format mesej Telegram
// -------------------------------------------------------------
function fmtPct(v, suffix = '%') {
    if (v == null || isNaN(v)) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(1) + suffix;
}
function fmtPlain(v) {
    if (v == null || isNaN(v)) return '—';
    return v.toFixed(1) + '%';
}
function fmtPrice(v) {
    if (v == null || isNaN(v)) return '—';
    return (+v).toFixed(3);
}

function buildMessage(now, out) {
    const myt = new Date(now.getTime() + 8 * 3600 * 1000);
    const dateStr = myt.toISOString().slice(0, 10);
    const timeStr = myt.toISOString().slice(11, 16);

    let dataTxt = 'Harga: Yahoo live (last trade, sebelum tutup 5:00pm)';
    if (out.dataTime) {
        const dt = new Date(out.dataTime + 8 * 3600 * 1000);
        dataTxt = `Harga: Yahoo live · last trade ${dt.toISOString().slice(11, 16)} MYT (${dt.toISOString().slice(0, 10)})`;
    }

    const lines = [];
    lines.push(`📋 BUY LIST — ${dateStr} ${timeStr} MYT`);
    lines.push(dataTxt);
    lines.push('');

    // ---- Fresh Rider ----
    const fr = out.freshRider;
    lines.push(`🚀 FRESH RIDER (${fr.list.length})`);
    if (fr.list.length === 0) {
        lines.push('   Tiada setup hari ini.');
    } else {
        for (const s of fr.list) {
            const badge = s.badge ? s.badge + ' ' : '';
            const floorTxt = s.floorDist != null ? ` · lantai ${s.floorDist.toFixed(1)}%` : '';
            const entryTxt = s.inTracker ? '📌 DAH TRACKED' : '🔵 ENTRY BARU';
            lines.push(`   ${badge}${s.name} RM${fmtPrice(s.price)} (${fmtPct(s.changePct)}) · pullback ${fmtPlain(s.pullback)}${floorTxt} · SL RM${fmtPrice(s.sl)} ${entryTxt}`);
        }
    }
    if (fr.newCount > 0 || fr.reentryCount > 0) lines.push(`   ➕ ${fr.newCount} baru / ${fr.reentryCount} re-entry`);
    const frNew = fr.list.filter(s => !s.inTracker);
    lines.push(frNew.length
        ? `   🔵 Akan direkod dalam live tracker: ${frNew.map(s => s.name).join(', ')}`
        : '   📌 Semua dah dalam tracker — tiada entry tracker baru hari ini');
    lines.push('');

    // ---- Hot Theme ----
    const ht = out.hotTheme;
    lines.push(`🔥 HOT THEME (${ht.list.length})`);
    if (ht.list.length === 0) {
        lines.push('   Tiada setup hari ini.');
    } else {
        for (const s of ht.list) {
            const badge = s.badge ? s.badge + ' ' : '';
            const triple = s.confluence >= 3 ? 'TRIPLE' : 'DOUBLE';
            const floorTxt = s.floorDist != null ? ` · lantai ${s.floorDist.toFixed(1)}%` : '';
            const entryTxt = s.inTracker ? '📌 DAH TRACKED' : '🔵 ENTRY BARU';
            lines.push(`   ${badge}${s.name} RM${fmtPrice(s.price)} (${fmtPct(s.changePct)}) · ${triple} (${s.confluence}) · pullback ${fmtPlain(s.pullback)}${floorTxt} · SL RM${fmtPrice(s.sl)} ${entryTxt}`);
        }
    }
    if (ht.newCount > 0 || ht.reentryCount > 0) lines.push(`   ➕ ${ht.newCount} baru / ${ht.reentryCount} re-entry`);
    const htNew = ht.list.filter(s => !s.inTracker);
    lines.push(htNew.length
        ? `   🔵 Akan direkod dalam live tracker: ${htNew.map(s => s.name).join(', ')}`
        : '   📌 Semua dah dalam tracker — tiada entry tracker baru hari ini');
    lines.push('');

    // ---- SL warning ----
    if (out.slWarnings.length > 0) {
        lines.push('⚠️ SL WARNING — posisi bawah trailing stop (pertimbang keluar):');
        for (const w of out.slWarnings) {
            lines.push(`   ${w.name} RM${w.price} vs SL RM${w.slTrail} (${w.tracker})`);
        }
        lines.push('');
    }

    lines.push(`Trackers: FR ${out.frTracked} unik / HT ${out.htTracked} unik`);
    lines.push('Dijana oleh buy_alert.js · JerungBursa');
    return lines.join('\n');
}

// -------------------------------------------------------------
// MAIN
// -------------------------------------------------------------
(async () => {
    const now = new Date();

    // 1. Load live_data.json
    const liveFile = path.join(__dirname, 'live_data.json');
    if (!fs.existsSync(liveFile)) { console.error('❌ live_data.json tidak wujud — jalankan scrape-real.js dulu.'); process.exit(1); }
    const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
    const rows = (live.topVolume || []).filter(r => r && r.name);

    console.log(`📦 Loaded ${rows.length} stocks dari live_data.json (${live.lastUpdated || '?'})`);

    // 2. Load trackers (untuk badge + SL warning)
    const frTrades = loadTrackerTrades(path.join(__dirname, 'fresh_rider_tracker.js'));
    const htTrades = loadTrackerTrades(path.join(__dirname, 'hot_theme_tracker.js'));
    const frTrackedNames = new Set(frTrades.map(t => (t.name || '').toUpperCase()));
    const htTrackedNames = new Set(htTrades.map(t => (t.name || '').toUpperCase()));
    const openFr = frTrades.filter(t => t.status === 'OPEN');
    const openHt = htTrades.filter(t => t.status === 'OPEN');
    console.log(`📡 Tracker: FR ${frTrades.length} unik (${openFr.length} OPEN) / HT ${htTrades.length} unik (${openHt.length} OPEN)`);

    // 3. Universe calon: semua baris topVolume (site pun guna topVolume utk list atas)
    const candidates = rows.slice();

    // 4. Resolve simbol (SYM_MAP → stock.code → dinamik i3investor) & fetch harga live
    console.log('🌐 Fetch harga live Yahoo...');
    const symbolByStock = new Map();
    await pLimit(10, candidates, async (stock) => {
        let sym = resolveSymbol(stock.name);
        if (!sym && stock.code) sym = String(stock.code).includes('.') ? stock.code : stock.code + '.KL';
        if (!sym) sym = await fetchDynamicCode(stock.name);
        if (sym) symbolByStock.set(stock.name.toUpperCase(), sym);
    });

    const yahooMap = {};
    await pLimit(10, candidates, async (stock) => {
        const sym = symbolByStock.get(stock.name.toUpperCase());
        if (!sym) return;
        const y = await fetchYahoo(sym);
        if (y) yahooMap[sym] = y;
    });
    console.log(`✅ Harga live: ${Object.keys(yahooMap).length}/${candidates.length} simbol`);

    // Masa last trade terkini (max regularMarketTime)
    let dataTime = 0;
    for (const y of Object.values(yahooMap)) {
        if (y && y.dataTime > dataTime) dataTime = y.dataTime;
    }

    let updated = 0;
    for (const stock of candidates) {
        const sym = symbolByStock.get(stock.name.toUpperCase());
        const y = sym ? yahooMap[sym] : null;
        const bars = y ? y.bars : null;
        if (!bars || bars.length < 2) continue;
        const prevClose = bars[bars.length - 2].close;
        if (applyYahooBar(stock, bars, prevClose)) updated++;
    }
    console.log(`✅ ${updated} kaunter dikemas kini harga intraday`);

    // 4b. Refresh struktur harian utk kaunter yang high52/floor stale
    let refreshed = 0;
    for (const stock of candidates) {
        const staleHigh = stock.high52 && stock.price > stock.high52 * 1.05;
        const staleFloor = stock.floorLow && stock.price < stock.floorLow * 0.95;
        if (!staleHigh && !staleFloor) continue;
        const sym = symbolByStock.get(stock.name.toUpperCase());
        if (!sym) continue;
        if (await refreshYearly(stock, sym)) refreshed++;
    }
    if (refreshed) console.log(`🔄 ${refreshed} kaunter snapshot stale dikemas kini dari Yahoo 1y`);

    // 5. Kira list FR & HT hari ini
    const frList = candidates.filter(isFreshRiderPick);
    const htList = candidates.filter(isHotThemePick);

    // 6. Badge BARU / RE-ENTRY — scan 30 hari history (sebelum hari ini)
    const todayStr = now.toISOString().slice(0, 10);
    const recentFr = new Set(), recentHt = new Set();
    const scanned = new Set();
    for (let back = 1; back <= 30; back++) {
        const d = new Date(now.getTime() - back * 24 * 3600 * 1000);
        const ds = d.toISOString().slice(0, 10);
        if (!isTradingDay(ds)) continue;
        const day = loadHistoryDay(ds);
        for (const it of day) {
            if (!it || !it.name) continue;
            const up = canonName(it.name).toUpperCase();
            if (isFreshRiderPick(it)) recentFr.add(up);
            if (isHotThemePick(it)) recentHt.add(up);
        }
        scanned.add(ds);
    }
    console.log(`🕰️ Scan ${scanned.size} hari history utk badge BARU/RE-ENTRY`);

    function badgeFor(name, recentSet, trackedSet) {
        const up = (name || '').toUpperCase();
        if (!recentSet.has(up)) {
            return trackedSet.has(up) ? '🟢 RE-ENTRY' : '🆕 BARU';
        }
        return null;
    }

    const frOut = frList.map(s => {
        const floor = s.floorLow || s.price * 0.95;
        return {
            name: s.name, price: s.price, changePct: s.changePct, pullback: s.pullback,
            floorDist: s.floorDist, floor,
            // Sama macam generator tracker: SL = trail 20% dari high (entry baru: high = harga).
            sl: +(s.price * 0.80).toFixed(3),
            inTracker: frTrackedNames.has(canonName(s.name).toUpperCase()),
            badge: badgeFor(s.name, recentFr, frTrackedNames)
        };
    });
    const htOut = htList.map(s => {
        const floor = s.floorLow || s.price * 0.95;
        // Sama macam hotThemeExit() generator: max(lantai*0.97, trail high*0.80) utk entry baru.
        const sl = Math.max(floor * 0.97, s.price * 0.80);
        return {
            name: s.name, price: s.price, changePct: s.changePct, pullback: s.pullback,
            floorDist: s.floorDist, floor, confluence: confluenceCount(s),
            sl: +sl.toFixed(3),
            inTracker: htTrackedNames.has(canonName(s.name).toUpperCase()),
            badge: badgeFor(s.name, recentHt, htTrackedNames)
        };
    });
    // Susun: FR ikut jarak ke lantai (risiko kecil dulu); HT ikut confluence desc, then floorDist asc
    frOut.sort((a, b) => (a.floorDist ?? 99) - (b.floorDist ?? 99));
    htOut.sort((a, b) => (b.confluence - a.confluence) || ((a.floorDist ?? 99) - (b.floorDist ?? 99)));

    // 7. SL warning — posisi OPEN tracker bawah trailing stop
    const slWarnings = [];
    for (const { t, tracker } of [...openFr.map(t => ({ t, tracker: 'FR' })), ...openHt.map(t => ({ t, tracker: 'HT' }))]) {
        const sym = symbolByStock.get((t.name || '').toUpperCase()) || resolveSymbol(t.name);
        let price = t.currentPrice;
        const y = sym ? yahooMap[sym] : null;
        if (y && y.bars && y.bars.length) {
            const last = y.bars[y.bars.length - 1];
            if (last.close > 0) price = last.close;
        }
        const sl = t.slTrail;
        if (sl && price > 0 && price <= sl) {
            slWarnings.push({ name: t.name, price: +(+price).toFixed(3), slTrail: +(+sl).toFixed(3), tracker });
        }
    }
    slWarnings.sort((a, b) => (a.price / a.slTrail) - (b.price / b.slTrail));

    // 8. Format & hantar
    const out = {
        generatedAt: now.toISOString(),
        dataTime,
        freshRider: { list: frOut, newCount: frOut.filter(s => s.badge === '🆕 BARU').length, reentryCount: frOut.filter(s => s.badge === '🟢 RE-ENTRY').length },
        hotTheme: { list: htOut, newCount: htOut.filter(s => s.badge === '🆕 BARU').length, reentryCount: htOut.filter(s => s.badge === '🟢 RE-ENTRY').length },
        slWarnings,
        frTracked: frTrades.length,
        htTracked: htTrades.length,
    };
    const msg = buildMessage(now, out);

    // Simpan output untuk rujukan
    fs.writeFileSync(path.join(__dirname, 'buy_alert_latest.json'), JSON.stringify(out, null, 2), 'utf8');
    console.log('\n' + msg + '\n');

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
        try {
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            const body = JSON.stringify({ chat_id: chatId, text: msg });
            const r = await new Promise((resolve, reject) => {
                const req = https.request(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
                }, (res) => {
                    let s = '';
                    res.on('data', d => s += d);
                    res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
                });
                req.on('error', reject);
                req.write(body);
                req.end();
            });
            if (r && r.ok) console.log('✅ Telegram: mesej dihantar.');
            else console.error('❌ Telegram gagal:', JSON.stringify(r));
        } catch (e) {
            console.error('❌ Telegram error:', e.message);
        }
    } else {
        console.log('ℹ️ TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID tidak diset — mesej dicetak di atas (no notification).');
    }
})().catch(e => {
    console.error('❌ buy_alert.js gagal:', e);
    process.exit(1);
});
