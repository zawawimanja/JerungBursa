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
const { execFileSync } = require('child_process');

const HIST_DIR = path.join(path.join(__dirname, '..'), 'history');

// -------------------------------------------------------------
// Load .env tempatan (jika wujud) — tanpa dependency tambahan.
// Env var sedia ada (cth. dari GitHub Actions) DIUTAMAKAN.
// -------------------------------------------------------------
function loadEnvFile() {
    try {
        const f = path.join(path.join(__dirname, '..'), '.env');
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
const SYM_MAP = JSON.parse(fs.readFileSync(path.join(path.join(__dirname, '..'), 'symbol_mappings.json'), 'utf8'));
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
    'Semiconductor': ['UNISEM','MI','VITROX','PENTA','UWC','KGB','NATGATE','FRONTKN','GREATEC','ELSOFT','ATE','PENTECH','KEEMING','HKB','ADNEX','ICENTS','AMS','MINOX','IFCAMSC','TEAMSTR','FAMIERA','SUMI','CRPMATE','PMIBHD','ECOMATE','ATECH','RAMSSOL','TOPMIX','SEMICO','MISC','OPPSTAR','INARI','MPI','SKYECHIP','SFPTECH','3REN','TTVHB','CORAZA','ECA','INFOM','LGMS','CLOUDPT','EDELTEQ','VSTECS','VTC','CEB','BETA','AGMO','SKPRES','VS','DUFU'],
    'Solar/RE': ['SLVEST','SOLARVEST','JSSOLAR','VERDANT','SAM','GENERGY','SAMAIDEN','NE','NORTHERN','MNHLDG','PECKHIN','PEKAT','SUNVIEW','HEGROUP','KJTS','CYPARK','MESTRON','PWRWELL']
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

// ---- Rule Fresh VVIP Rider (A5) — 100% Selari dengan index.html ----
function isFreshRiderPick(item) {
    if (!item || !item.name || item.price <= 0) return false;
    if (item.price < 0.10 || item.price > 50) return false;
    if (item.isVvip !== true || item.signal === 'avoid' || item.isCombStock) return false;
    if ((item.ipoYear || 0) < 2025) return false;
    const pb = item.pullback !== null && item.pullback !== undefined ? item.pullback : 99;
    if (pb > 10.0) return false;
    if (item.ipoAge != null && item.ipoAge < 15 && (item.touchCount || 0) < 2) return false;

    const isGreenBreakout = (item.change >= 0 || (item.changePct || 0) >= 0);
    const tight = typeof item.closeTightness === 'number' ? item.closeTightness : 99;
    if (item.hasVolumeSpike === true) {
        if (!isGreenBreakout || tight > 10.0) return false;
    } else {
        if (tight > 5.0) return false;
    }
    return true;
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

    // Pullback dari 52W high (price-driven — guna high52 scanner, bukan Yahoo)
    if (item.high52) item.pullback = +(((item.high52 - item.price) / item.high52) * 100).toFixed(2);

    // NOTA: volumeSpike/closeTightness/floorDist TIDAK dikira semula dari Yahoo —
    // Yahoo volum & close utk Bursa tak konsisten dengan scanner i3investor dan boleh
    // flip CS MERAH/HIJAU + qualification (cth. MTTSL volSpike 2.1x scanner = CS HIJAU
    // tapi Yahoo nampak no spike -> keluar dalam alert, tak dalam web). Kekal nilai
    // scanner supaya alert konsisten dengan web.
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
        const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
        const qClose = q.close || [];
        const qOpen = q.open || [];
        const qHigh = q.high || [];
        const qLow = q.low || [];
        const qVol = q.volume || [];
        const bars = [];
        for (let i = 0; i < ts.length; i++) {
            let closeVal = qClose[i];
            if ((closeVal == null || closeVal <= 0) && i === ts.length - 1 && meta.regularMarketPrice > 0) {
                closeVal = meta.regularMarketPrice;
            }
            if (closeVal == null || closeVal <= 0) continue;
            bars.push({
                date: new Date(ts[i] * 1000 + 8 * 3600 * 1000).toISOString().slice(0, 10),
                open: qOpen[i] || closeVal,
                high: qHigh[i] || closeVal,
                low: qLow[i] || closeVal,
                close: closeVal,
                volume: qVol[i] || 0
            });
        }
        // Masa last trade sebenar (meta.regularMarketTime) — penting utk
        // sahkan harga yang digunakan betul-betul waktu 4:30 petang.
        const dataTime = (meta.regularMarketTime || (ts.length ? ts[ts.length - 1] : 0)) * 1000;
        return { bars, dataTime, regularMarketPrice: meta.regularMarketPrice, prevClose: meta.chartPreviousClose || meta.previousClose };
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

const vm = require('vm');

// -------------------------------------------------------------
// Load tracker file (window.X = {...}; — guna VM context yang selamat & sokong multiple window assignments)
// -------------------------------------------------------------
function loadTrackerTrades(file) {
    if (!fs.existsSync(file)) return [];
    try {
        const raw = fs.readFileSync(file, 'utf8');
        const sandbox = { window: {} };
        vm.runInNewContext(raw, sandbox);
        const all = sandbox.window.ALL_TRACKER;
        const fr = sandbox.window.FRESH_RIDER_TRACKER;
        const addOn = sandbox.window.ADD_ON_TRACKER;
        const floorAddOn = sandbox.window.FLOOR_ADDON_TRACKER;
        const ht = sandbox.window.HOT_THEME_TRACKER;
        const allTrades = [];
        if (all && Array.isArray(all.trades) && all.trades.length > 0) {
            allTrades.push(...all.trades);
        } else {
            if (fr && Array.isArray(fr.trades)) allTrades.push(...fr.trades);
            if (addOn && Array.isArray(addOn.trades)) allTrades.push(...addOn.trades);
            if (floorAddOn && Array.isArray(floorAddOn.trades)) allTrades.push(...floorAddOn.trades);
        }
        if (ht && Array.isArray(ht.trades)) allTrades.push(...ht.trades);
        return allTrades;
    } catch (e) {
        return [];
    }
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

const { BURSA_MALAYSIA_HOLIDAYS, isTradingDay } = require('./lib/bursa_calendar');

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

function formatStockCard(s) {
    const tvUrl = `https://www.tradingview.com/chart/?symbol=MYX:${s.name}&interval=D`;
    const gradeStr = s.grade && s.grade !== '—' && s.grade !== 'Unrated' ? ` (${s.grade})` : (s.grade === 'Unrated' ? ' (Unrated)' : '');
    
    // 1. Freshness badge
    const freshnessBadge = s.label ? ` ${s.label}` : '';
    
    // 2. Kumpulan / Whale
    let kumpulanBadge = '';
    if (s.isKumpulan || s._whaleInst) {
        const shortWhale = s._whaleInst ? s._whaleInst.split(' ')[0] : 'JERUNG';
        kumpulanBadge = ` 🏛️ ${shortWhale}`;
    }
    
    // 3. Positive catalysts
    let catalystBadges = '';
    const nbList = s.newsBadges || [];
    for (const nb of nbList) {
        if (nb.type === 'JERUNG_5PCT') catalystBadges += ' 🐋 Jerung 5%+';
        else if (nb.type === 'EV_CATALYST') catalystBadges += ' ⚡ EV Catalyst';
        else if (nb.type === 'AI_CATALYST') catalystBadges += ' 🤖 AI Catalyst';
        else if (nb.type === 'CONTRACT_WIN') catalystBadges += ' 📜 Contract Win';
    }
    
    // 4. Swan badge
    const swanBadge = s.swanBadge ? ` ${s.swanBadge}` : ' 🟢 🛡️ Swan: PASS';

    // 5. Golden Combo Evaluation (Tightness <= 2.5%, Floor <= 3.5%, TO RM 2M-10M, Change >= -1.0%)
    const isGoldenCombo = (
        s.tight != null && s.tight <= 2.5 &&
        s.floorDist != null && s.floorDist >= -1.0 && s.floorDist <= 3.5 &&
        s.turnover >= 2000000 && s.turnover <= 10000000 &&
        (s.changePct == null || s.changePct >= -1.0)
    );
    const goldenBadge = isGoldenCombo ? '\n  👑 *GOLDEN COMBO A++ (Quant WR 83%, Avg +23.7%)*' : '';
    
    const lines = [
        `• *[${s.name}](${tvUrl})*${gradeStr}${freshnessBadge}${kumpulanBadge}${catalystBadges}${swanBadge}${goldenBadge}`,
        `  💵 Harga: *RM ${fmtPrice(s.price)}* (${fmtPct(s.changePct)}) | TO: *RM ${(s.turnover / 1000000).toFixed(2)}M*`,
        `  🛡️ Lantai: *RM ${fmtPrice(s.floor)}* (${fmtPlain(s.floorDist)} · ${s.touch}x) | Squeeze: *tight ${s.tight != null ? s.tight.toFixed(2) + '%' : '—'}*`,
        `  🛑 SL Cadangan: *RM ${fmtPrice(s.sl)}* | Skor: *${s.confidenceScore || 80}/100*`
    ];
    return lines.join('\n');
}


function buildMessage(now, out) {
    const myt = new Date(now.getTime() + 8 * 3600 * 1000);
    const dateStr = myt.toISOString().slice(0, 10);
    const timeStr = myt.toISOString().slice(11, 16);

    const lines = [];
    lines.push(`🔔 *SMART MONEY TRACKER — MARKET CLOSE BUY ALERT*`);
    lines.push(`⏰ ${dateStr} ${timeStr} MYT · Sesi Pasaran Selesai (Post-Market Close)`);
    lines.push('');

    // ---- Fresh Rider Top Ranking VVIP ----
    const fr = out.freshRider;
    lines.push(`🏆 *FRESH RIDER VVIP (${fr.list.length} Kaunter Terpilih)*`);
    lines.push('──────────────────────────────');

    if (fr.list.length === 0) {
        lines.push('Tiada setup Fresh Rider yang menepati kriteria hari ini.');
    } else {
        fr.list.forEach((s) => {
            lines.push(formatStockCard(s));
            lines.push('');
        });
    }

    // ---- Hot Theme Sector Riders ----
    const ht = out.hotTheme;
    if (ht && ht.list && ht.list.length > 0) {
        lines.push(`⚡ *HOT THEME RIDERS (${ht.list.length} Top Sector Leaders)*`);
        lines.push('──────────────────────────────');

        ht.list.forEach((s) => {
            lines.push(formatStockCard(s));
            lines.push('');
        });
    }

    lines.push('Generated by buy_alert.js · JerungBursa');
    return lines.join('\n');
}

// -------------------------------------------------------------
// MAIN
// -------------------------------------------------------------
(async () => {
    const now = new Date();

    // 1. Load live_data.json
    const liveFile = path.join(path.join(__dirname, '..'), 'live_data.json');
    if (!fs.existsSync(liveFile)) { console.error('❌ live_data.json tidak wujud — jalankan scrape-real.js dulu.'); process.exit(1); }
    const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
    const rows = (live.topVolume || []).filter(r => r && r.name);

    console.log(`📦 Loaded ${rows.length} stocks dari live_data.json (${live.lastUpdated || '?'})`);

    // 2. Load trackers (untuk badge + SL warning — susunan OPEN mengatasi CLOSED sama macam index.html)
    const frTrades = loadTrackerTrades(path.join(path.join(__dirname, '..'), 'fresh_rider_tracker.js'));
    const htTrades = loadTrackerTrades(path.join(path.join(__dirname, '..'), 'hot_theme_tracker.js'));

    const frTrackMap = new Map();
    frTrades.filter(t => t.status !== 'OPEN').sort((a,b) => (a.entryDate || '').localeCompare(b.entryDate || '')).forEach(t => {
        frTrackMap.set(canonName(t.name).toUpperCase(), t);
    });
    frTrades.filter(t => t.status === 'OPEN').sort((a,b) => (a.entryDate || '').localeCompare(b.entryDate || '')).forEach(t => {
        frTrackMap.set(canonName(t.name).toUpperCase(), t);
    });

    const htTrackMap = new Map();
    for (const t of htTrades) {
        const sym = canonName(t.name).toUpperCase();
        if (!htTrackMap.has(sym) || t.entryDate > htTrackMap.get(sym).entryDate || (t.status === 'OPEN' && htTrackMap.get(sym).status !== 'OPEN')) {
            htTrackMap.set(sym, t);
        }
    }
    const frTrackedNames = new Set(frTrackMap.keys());
    const htTrackedNames = new Set(htTrackMap.keys());
    const openFr = frTrades.filter(t => t.status === 'OPEN');
    const openHt = htTrades.filter(t => t.status === 'OPEN');
    console.log(`📡 Tracker: FR ${frTrades.length} rekod (${openFr.length} OPEN) / HT ${htTrades.length} rekod (${openHt.length} OPEN)`);

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

    // Tarikh snapshot (live_data.json) — elak Yahoo data LAGGING timpa harga yang lebih baru.
    // Contoh: Yahoo chart utk sesetengah penny stock terhenti 14-Ogos, snapshot dah 17-Ogos —
    // kalau diterapkan, alert guna harga lama dan list tak sama dengan web.
    const snapDate = (live.lastUpdated || '').slice(0, 10);
    let updated = 0;
    let skippedStale = 0;
    for (const stock of candidates) {
        const sym = symbolByStock.get(stock.name.toUpperCase());
        const y = sym ? yahooMap[sym] : null;
        const bars = y ? y.bars : null;
        if (!bars || bars.length < 2) continue;
        // Yahoo lebih lama dari snapshot -> jangan guna (snapshot lebih baru)
        const lastBarDate = bars[bars.length - 1].date;
        if (snapDate && lastBarDate && lastBarDate < snapDate) { skippedStale++; continue; }
        const prevClose = bars[bars.length - 2].close;
        if (applyYahooBar(stock, bars, prevClose)) updated++;
    }
    console.log(`✅ ${updated} kaunter dikemas kini harga intraday${skippedStale ? ` (${skippedStale} skip — Yahoo lagging vs snapshot)` : ''}`);

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

    // 5. Lantai DINAMIK & Pengiraan Kesegaran (100% Selari dengan index.html)
    function getRecentFloorMap() {
        const minMap = new Map();
        try {
            const eqFile = path.join(path.join(__dirname, '..'), 'daily_equity_tracker.js');
            if (fs.existsSync(eqFile)) {
                const eqCode = fs.readFileSync(eqFile, 'utf8');
                const sandbox = { window: {} };
                vm.runInNewContext(eqCode, sandbox);
                const eqData = sandbox.window.DAILY_EQUITY_TRACKER;
                if (eqData && Array.isArray(eqData.timeline) && eqData.timeline.length > 0) {
                    const timeline = eqData.timeline;
                    const startIdx = Math.max(0, timeline.length - 1 - 5);
                    for (let i = startIdx; i < timeline.length; i++) {
                        const snap = timeline[i];
                        if (snap && Array.isArray(snap.trades)) {
                            snap.trades.forEach(it => {
                                if (!it || !it.name) return;
                                const price = it.priceOnDay || it.currentPrice || it.entry;
                                if (price > 0) {
                                    const nm = (it.name || '').toUpperCase();
                                    const cur = minMap.get(nm);
                                    if (cur === undefined || price < cur) minMap.set(nm, price);
                                }
                            });
                        }
                    }
                }
            }
        } catch (e) { /* fallback */ }

        frTrades.forEach(t => {
            if (t && t.name) {
                const nm = (t.name || '').toUpperCase();
                if (!minMap.has(nm)) {
                    const fl = t.currentFloor || t.entryFloor || (t.entry ? t.entry * 0.95 : 0);
                    if (fl > 0) minMap.set(nm, fl);
                }
            }
        });
        return minMap;
    }
    const recentFloor = getRecentFloorMap();
    function formatShortDate(dStr) {
        if (!dStr) return '—';
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const p = dStr.split('-');
        if (p.length === 3) {
            const mIdx = parseInt(p[1], 10) - 1;
            return `${parseInt(p[2], 10)} ${months[mIdx] || p[1]}`;
        }
        return dStr;
    }

    function getRecentBaseTrigger(item, curRefDate, trackMap) {
        if (!item) return { price: 0, dateStr: '—', distPct: 0, isDayOne: false, isBase2: false };
        const nm = canonName(item.name).toUpperCase();
        const trTrade = trackMap ? trackMap.get(nm) : null;

        if (!trTrade || !trTrade.entry || (trTrade.entryDate && trTrade.entryDate >= curRefDate)) {
            return { price: item.price, dateStr: 'Hari Ini', distPct: 0, isDayOne: true, isBase2: false };
        }

        const originDist = ((item.price - trTrade.entry) / trTrade.entry) * 100;
        return {
            price: trTrade.entry,
            dateStr: trTrade.entryDate ? formatShortDate(trTrade.entryDate) : '—',
            distPct: originDist,
            isDayOne: false,
            isBase2: false
        };
    }

    function effFloor(name, price, floorLow) {
        const nm = canonName(name).toUpperCase();
        const rf = recentFloor.get(nm) || 0;
        const f = floorLow || 0;
        if (f > 0 && rf > 0 && ((price - f) / f) > 0.10) return Math.max(f, rf);
        return f || rf || 0;
    }

    function effFloorOfHT(item) {
        const clean = canonName(item.name).toUpperCase();
        const rf = recentFloor.get(clean) || 0;
        const f = item.floorLow || 0;
        if (f > 0 && rf > 0 && ((item.price - f) / f) > 0.10) return Math.max(f, rf);
        return f || rf || 0;
    }

    // Status Kesegaran (SAMA SEBIJI DENGAN INDEX.HTML):
    // 0 = 🔥 NEW (Day 1)
    // 1 = ⭐ ADD-ON A+ (AWAL)
    // 2 = 🛡️ ADD-ON (LANTAI RAPAT)
    // 3 = ➕ ADD-ON (Standard)
    // 4 = ⚠️ ADD-ON (+X% / Pucuk / Extended) — DILARANG SAMA SEKALI DALAM TOP RANKING
    // 99 = 🟢 RE-ENTRY (Kaunter luar tracker)
    function frFreshness(it) {
        const clean = canonName(it.name).toUpperCase();
        const tr = frTrackMap.get(clean);
        if (!tr) return 0; // 🔥 NEW (Day 1)
        if (tr.status === 'OPEN') {
            if (tr.entryDate && snapDate && tr.entryDate >= snapDate) {
                if (tr.entryType && tr.entryType.includes('LANTAI RAPAT')) return 2;
                if (tr.entryType && tr.entryType.includes('ADD-ON')) return 1;
                return 0;
            }
            const entryP = tr.entry || 0;
            const pct = (entryP > 0 && it.price) ? ((it.price - entryP) / entryP) * 100 : 0;
            const ef = effFloor(clean, it.price, it.floorLow || it.price * 0.95);
            const fd = (ef && it.price) ? ((it.price - ef) / ef) * 100 : 99;
            const toVal = it.turnover || it.rawTurnover || 0;
            const touches = it.touchCount || 0;
            const tight = typeof it.closeTightness === 'number' ? it.closeTightness : 99;

            const isSolidBase2 = (touches >= 3 && tight <= 3.5 && fd <= 4.5 && (toVal >= 2000000 || toVal === 0));
            const isFreshBase1 = (pct >= 0 && pct <= 20 && fd <= 3.5 && (toVal >= 2000000 || toVal === 0));
            if (isFreshBase1) return 1; // ⭐ ADD-ON A+ (AWAL)
            if (isSolidBase2) return 2; // 🛡️ ADD-ON (LANTAI RAPAT)
            if (pct > 20 && fd > 5.0) return 4; // ⚠️ Dilarang / Pucuk (+X%)
            return 3; // ➕ ADD-ON biasa
        }
        return 4; // Terkena SL / Tutup
    }

    function htFreshness(it) {
        const clean = canonName(it.name).toUpperCase();
        const tr = htTrackMap.get(clean);
        const ef = effFloorOfHT(it);
        const fd = (ef && it.price) ? ((it.price - ef) / ef) * 100 : 99;
        const toVal = it.turnover || it.rawTurnover || 0;
        const touches = it.touchCount || 0;
        const tight = typeof it.closeTightness === 'number' ? it.closeTightness : 99;

        if (!tr || tr.status !== 'OPEN') {
            if (fd >= -1.0 && fd <= 3.5 && tight <= 3.5 && toVal >= 1500000) return 0;
            return 99; // Standard un-tracked / Re-entry
        }
        if (tr.status === 'OPEN') {
            if (tr.entryDate && snapDate && tr.entryDate >= snapDate) {
                if (tr.entryType && tr.entryType.includes('LANTAI RAPAT')) return 2;
                if (tr.entryType && tr.entryType.includes('ADD-ON')) return 1;
                return 0;
            }
            const entryP = tr.entry || 0;
            const pct = (entryP > 0 && it.price) ? ((it.price - entryP) / entryP) * 100 : 0;
            const isSolidBase2 = (touches >= 3 && tight <= 3.5 && fd <= 4.5 && (toVal >= 2000000 || toVal === 0));
            const isFreshBase1 = (pct >= 0 && pct <= 20 && fd <= 3.5 && (toVal >= 2000000 || toVal === 0));
            if (isFreshBase1) return 1; // ⭐ ADD-ON A+ (AWAL)
            if (isSolidBase2) return 2; // 🛡️ ADD-ON (LANTAI RAPAT)
            if (pct > 20 && fd > 5.0) return 4; // ⚠️ Dilarang / Pucuk (+X%)
            return 3; // ➕ ADD-ON biasa
        }
        return 4;
    }

    function formatFreshnessBadge(code, stock, trMap) {
        if (code === 0) return '🔥 NEW (Day 1)';
        if (code === 1) return '⭐ ADD-ON A+ (AWAL)';
        if (code === 2) return '🛡️ ADD-ON (LANTAI RAPAT)';
        if (code === 3) return '➕ ADD-ON';
        if (code === 4) {
            const clean = canonName(stock.name).toUpperCase();
            const tr = trMap.get(clean);
            if (tr && tr.entry) {
                const gain = ((stock.price - tr.entry) / tr.entry) * 100;
                return `⚠️ ADD-ON (+${gain.toFixed(0)}%)`;
            }
            return '⚠️ ADD-ON';
        }
        return '🟢 RE-ENTRY';
    }

    let newsData = {};
    try {
        const newsPath = path.join(path.join(__dirname, '..'), 'news_data.js');
        if (fs.existsSync(newsPath)) {
            const rawNews = fs.readFileSync(newsPath, 'utf8');
            const ctx = { window: {} };
            vm.runInNewContext(rawNews, ctx);
            newsData = ctx.window.NEWS_DATA || ctx.NEWS_DATA || {};
        }
    } catch (e) {}

    function isBlackSwanClean(s) {
        const up = canonName(s.name || '').toUpperCase();
        const news = newsData[up];
        const refDate = now;
        if (news && Array.isArray(news.entitlements)) {
            for (const ent of news.entitlements) {
                if (!ent.isDividend || !ent.exDate) continue;
                const exD = new Date(ent.exDate);
                if (isNaN(exD.getTime())) continue;
                const diffDays = Math.round((exD.getTime() - refDate.getTime()) / (24 * 3600 * 1000));
                if (diffDays >= -1 && diffDays <= 10) return false;
            }
        }
        if (news && Array.isArray(news.announcements)) {
            for (const ann of news.announcements) {
                const cat = (ann.category || '').toUpperCase();
                const title = (ann.title || '').toUpperCase();
                if (title.includes('QUARTERLY') || title.includes('FINANCIAL RESULTS') || cat.includes('FINANCIAL')) {
                    const annD = new Date(ann.date);
                    if (!isNaN(annD.getTime())) {
                        const diffDays = Math.round((annD.getTime() - refDate.getTime()) / (24 * 3600 * 1000));
                        if (diffDays >= -3 && diffDays <= 5) return false;
                    }
                }
            }
        }
        return true;
    }

    function getTierOfFR(s) {
        const effF = effFloor(s.name, s.price, s.floorLow || s.price * 0.95);
        const toVal = s.rawTurnover || s.turnover || 0;
        const tightValNum = typeof s.closeTightness === 'number' ? s.closeTightness : 99;
        const fDistVal = effF ? +(((s.price - effF) / effF) * 100).toFixed(2) : 99;
        const isDump = s.hasUpperWickRejection === true && (s.change < 0 || (s.changePct && s.changePct < 0));
        const isSwanClean = isBlackSwanClean(s);
        const isTierAPlus = (toVal >= 2000000 && tightValNum <= 3.5 && fDistVal >= -1.0 && fDistVal <= 3.5 && isSwanClean && !isDump);
        const isTierA = (!isTierAPlus && toVal >= 1000000 && tightValNum <= 4.85 && fDistVal >= -1.5 && fDistVal <= 5.0 && isSwanClean && !isDump);
        const tierBadge = isTierAPlus ? '⭐ TIER A+ SNIPER' : (isTierA ? '🎯 TIER A' : '⚪ TIER B');
        return { isTierAPlus, isTierA, tierBadge, toVal, tightValNum, fDistVal, isSwanClean, isDump, effF };
    }

    function getTierOfHT(s) {
        const effF = effFloorOfHT(s);
        const toVal = s.rawTurnover || s.turnover || 0;
        const tightValNum = typeof s.closeTightness === 'number' ? s.closeTightness : 99;
        const fDistVal = effF ? +(((s.price - effF) / effF) * 100).toFixed(2) : 99;
        const isDump = s.hasUpperWickRejection === true && (s.change < 0 || (s.changePct && s.changePct < 0));
        const isSwanClean = isBlackSwanClean(s);
        const isTierAPlus = (toVal >= 2000000 && tightValNum <= 3.5 && fDistVal >= -1.0 && fDistVal <= 3.5 && isSwanClean && !isDump);
        const isTierA = (!isTierAPlus && toVal >= 1000000 && tightValNum <= 4.85 && fDistVal >= -1.5 && fDistVal <= 5.0 && isSwanClean && !isDump);
        const tierBadge = isTierAPlus ? '⭐ TIER A+ SNIPER' : (isTierA ? '🎯 TIER A' : '⚪ TIER B');
        return { isTierAPlus, isTierA, tierBadge, toVal, tightValNum, fDistVal, isSwanClean, isDump, effF };
    }

    // 6. Penapis Top Ranking VVIP (100% Selari dengan index.html)
    function passesTopRankingFR(p) {
        const t = getTierOfFR(p);
        const fresh = frFreshness(p);

        // 1. DILARANG SAMA SEKALI: Pucuk / Extended atau SL tepi jurang
        if (!t.isSwanClean || t.isDump || fresh === 4) return false;

        const nameKey = canonName(p.name).toUpperCase();
        const trackedEntry = frTrackMap.get(nameKey);

        // 2. DILARANG: Kaunter lama dalam FR Tracker yang sudah melepasi fasa Fresh Rider
        // (sudah untung > 20% dari entry atau bukan fresh base Day 1/Add-on)
        if (trackedEntry && trackedEntry.status === 'OPEN' && trackedEntry.entryDate < snapDate) {
            const entryP = trackedEntry.entry || 0;
            const pct = entryP > 0 ? ((p.price - entryP) / entryP) * 100 : 0;
            if (pct > 20 && fresh !== 1 && fresh !== 2) return false;
            if (fresh === 3) return false;
        }

        // 3. Semak sama ada kaunter ini SUDAH DISAHKAN dalam FR Tracker hari ini
        const isTrackerConfirmedToday = !!(
            trackedEntry &&
            trackedEntry.status === 'OPEN' &&
            trackedEntry.entryDate === snapDate
        );

        // 3. DILARANG: Kaunter turnover lemau / runcit (< RM 1.0M)
        if (t.toVal < 1000000 && !isTrackerConfirmedToday) return false;

        // 4. LAYAK: 🔥 NEW (Day 1 Breakout) — benarkan lilin breakout hijau
        if (fresh === 0) {
            return (t.fDistVal <= 10.0 && t.fDistVal >= -2.0 && t.tightValNum <= 10.0);
        }

        // 5. LAYAK: ⭐ ADD-ON A+ / 🛡️ ADD-ON (LANTAI RAPAT) — lantai rapat wajib <= 4.5%
        if (fresh === 1 || fresh === 2) {
            if (t.fDistVal > 4.5 || t.fDistVal < -2.0) return false;
            if (t.tightValNum <= 3.5) return true;
        }

        // 6. SOP: Hanya 3 jenis entry (NEW / ADD-ON A+ / LANTAI RAPAT) layak
        return false;
    }

    function passesTopRankingHT(p) {
        const t = getTierOfHT(p);
        const fresh = htFreshness(p);
        const isFusion = isFreshRiderPick(p) && getHotThemes(p.name).length > 0;

        // 1. DILARANG SAMA SEKALI: Pucuk / Extended atau SL tepi jurang
        if (fresh === 4) return false;

        // 2. Semak sama ada kaunter SUDAH DISAHKAN dalam HT Tracker hari ini
        const nameKeyHT = canonName(p.name).toUpperCase();
        const trackedEntryHT = htTrackMap.get(nameKeyHT);
        const isHtConfirmedToday = !!(
            trackedEntryHT &&
            trackedEntryHT.status === 'OPEN' &&
            trackedEntryHT.entryDate === snapDate
        );

        // 3. DILARANG: Kaunter turnover lemau / runcit (< RM 1.0M)
        if (t.toVal < 1000000 && !isHtConfirmedToday) return false;

        // 4. DILARANG: Terkena Black Swan Trap atau Selling Dump Merah
        if (!t.isSwanClean || t.isDump) return false;

        // 5. LAYAK: 🔥 NEW (Day 1 Breakout) — benarkan lilin breakout hijau
        if (fresh === 0) {
            return (t.fDistVal <= 10.0 && t.fDistVal >= -2.0 && t.tightValNum <= 10.0);
        }

        // 6. LAYAK: ⭐ ADD-ON A+ / 🛡️ ADD-ON (LANTAI RAPAT) — lantai rapat
        const maxAllowedFloorDist = ((p.touchCount || 0) >= 5 && t.toVal >= 2000000 && t.tightValNum <= 3.5) ? 6.8 : 4.8;
        if (t.fDistVal > maxAllowedFloorDist || t.fDistVal < -2.0) return false;

        // SOP: Hanya ⭐ ADD-ON A+ / 🛡️ LANTAI RAPAT (NEW sudah dikendalikan di atas).
        // Tier A+ & Fusion kekal sebagai cop kualiti (lencana / susunan), bukan pintu masuk.
        const meetsGolden = (t.tightValNum <= 4.8 && t.fDistVal <= maxAllowedFloorDist && t.toVal >= 1000000);
        return (fresh === 1 || fresh === 2) && meetsGolden;
    }

    const frList = candidates.filter(isFreshRiderPick).filter(passesTopRankingFR);
    const htList = candidates.filter(isHotThemePick).filter(passesTopRankingHT);

    const frOut = frList.map(s => {
        const tier = getTierOfFR(s);
        const fresh = frFreshness(s);
        const effF = tier.effF;
        const trBase = getRecentBaseTrigger(s, snapDate, frTrackMap);
        
        const isWhale = getHotThemes(s.name).length > 0 || (s.touchCount || 0) >= 10 || passesJerungRadar(s) || ((newsData[canonName(s.name).toUpperCase()] || {}).newsBadges || []).some(b => b.type === 'JERUNG_5PCT');
        let sniperScore = s.confidenceScore || 72;
        if ((s.touchCount || 0) >= 3 && isWhale) sniperScore += 18;
        else if (isWhale) sniperScore += 12;
        if (typeof s.closeTightness === 'number' && s.closeTightness <= 4.0 && (s.touchCount || 0) >= 4) sniperScore += 10;
        if (s.volumeDecline === true || (s.volumeSpike || 99) < 0.5) sniperScore += 6;
        sniperScore = Math.min(99, sniperScore);

        const fDist = tier.fDistVal;
        const isFreshDay1 = (fresh === 0 || Math.abs(fDist) < 0.1);
        const distBadge = isFreshDay1 ? '🟢 0.0% (DAY 1)' : (fDist <= 0 ? `⚪ ${fDist.toFixed(1)}% (At Base)` : (fDist <= 3.0 ? `🟢 +${fDist.toFixed(1)}%` : `⚪ +${fDist.toFixed(1)}%`));
        const rrRatio = fDist > 0 ? (10.0 / fDist).toFixed(1) : '—';

        const whaleInst = tier._whaleInst || (isWhale ? 'KUMPULAN' : '');

        return {
            name: s.name, price: s.price, changePct: s.changePct, pullback: s.pullback,
            tight: typeof s.closeTightness === 'number' ? s.closeTightness : null,
            floorDist: fDist, floor: effF,
            sl: +Math.max(s.price * 0.89, s.price * 0.80).toFixed(3),
            inTracker: frTrackedNames.has(canonName(s.name).toUpperCase()),
            label: formatFreshnessBadge(fresh, s, frTrackMap),
            tierBadge: tier.tierBadge,
            isTierAPlus: tier.isTierAPlus,
            isTierA: tier.isTierA,
            touch: s.touchCount || 0,
            turnover: tier.toVal,
            grade: s.ipoGrade || s.ipoYear || '—',
            confidenceScore: sniperScore,
            sector: s.sector || '',
            confluence: confluenceCount(s),
            isKumpulan: isWhale,
            _whaleInst: whaleInst,
            newsBadges: (newsData[canonName(s.name).toUpperCase()] || {}).newsBadges || [],
            swanBadge: isBlackSwanClean(s) ? '🟢 🛡️ Swan: PASS' : '⚠️ Swan: ALERT',
            triggerPrice: trBase.price,
            triggerDate: trBase.dateStr,
            distBadge: distBadge,
            rrRatio: rrRatio,
            _tier: tier,
            _freshness: fresh
        };
    });

    const htOut = htList.map(s => {
        const tier = getTierOfHT(s);
        const fresh = htFreshness(s);
        const effF = tier.effF;
        const trBase = getRecentBaseTrigger(s, snapDate, htTrackMap);
        
        const isWhale = getHotThemes(s.name).length > 0 || (s.touchCount || 0) >= 10 || passesJerungRadar(s) || ((newsData[canonName(s.name).toUpperCase()] || {}).newsBadges || []).some(b => b.type === 'JERUNG_5PCT');
        let sniperScore = s.confidenceScore || 72;
        if ((s.touchCount || 0) >= 3 && isWhale) sniperScore += 18;
        else if (isWhale) sniperScore += 12;
        if (typeof s.closeTightness === 'number' && s.closeTightness <= 4.0 && (s.touchCount || 0) >= 4) sniperScore += 10;
        if (s.volumeDecline === true || (s.volumeSpike || 99) < 0.5) sniperScore += 6;
        sniperScore = Math.min(99, sniperScore);

        const fDist = tier.fDistVal;
        const isFreshDay1 = (fresh === 0 || Math.abs(fDist) < 0.1);
        const distBadge = isFreshDay1 ? '🟢 0.0% (DAY 1)' : (fDist <= 0 ? `⚪ ${fDist.toFixed(1)}% (At Base)` : (fDist <= 3.0 ? `🟢 +${fDist.toFixed(1)}%` : `⚪ +${fDist.toFixed(1)}%`));
        const rrRatio = fDist > 0 ? (10.0 / fDist).toFixed(1) : '—';
        const sl = Math.max(effF * 0.97, s.price * 0.80);

        const whaleInst = tier._whaleInst || (isWhale ? 'KUMPULAN' : '');

        return {
            name: s.name, price: s.price, changePct: s.changePct, pullback: s.pullback,
            tight: typeof s.closeTightness === 'number' ? s.closeTightness : null,
            floorDist: fDist, floor: effF,
            confluence: confluenceCount(s),
            sl: +sl.toFixed(3),
            inTracker: htTrackedNames.has(canonName(s.name).toUpperCase()),
            label: formatFreshnessBadge(fresh, s, htTrackMap),
            tierBadge: tier.tierBadge,
            isTierAPlus: tier.isTierAPlus,
            isTierA: tier.isTierA,
            touch: s.touchCount || 0,
            turnover: tier.toVal,
            grade: s.ipoGrade || s.ipoYear || '—',
            confidenceScore: sniperScore,
            sector: s.sector || '',
            isKumpulan: isWhale,
            _whaleInst: whaleInst,
            newsBadges: (newsData[canonName(s.name).toUpperCase()] || {}).newsBadges || [],
            swanBadge: isBlackSwanClean(s) ? '🟢 🛡️ Swan: PASS' : '⚠️ Swan: ALERT',
            triggerPrice: trBase.price,
            triggerDate: trBase.dateStr,
            distBadge: distBadge,
            rrRatio: rrRatio,
            _tier: tier,
            _freshness: fresh
        };
    });

    // Susun mengikut susunan Top Ranking VVIP rasmi di web (index.html):
    // 0. Keutamaan Mutlak #0: 🔥 NEW (Day 1 Breakout) sentiasa menduduki tangga teratas sebagai entri segar!
    // 1. ⭐ TIER A+ SNIPER
    // 2. 🎯 TIER A
    // 3. Duit Jerung Aktif (Turnover >= RM 2.0M)
    // 4. 🔥⚡ FUSION (Lulus FR + HT)
    // 5. Freshness rank (0 = NEW < 1 = ADD-ON A+ < 2 = LANTAI RAPAT < 3 = STANDARD)
    // 6. Tightness % (paling mampat/squeeze)
    // 7. Floor dist % (SL nipis)
    // 8. Pullback %
    // 9. Turnover (paling besar)
    frOut.sort((a, b) => {
        const tierA = a._tier;
        const tierB = b._tier;
        const fa = a._freshness, fb = b._freshness;

        if (fa !== fb) {
            if (fa === 0 || fb === 0) return fa - fb;
        }
        if (tierA.isTierAPlus !== tierB.isTierAPlus) return tierB.isTierAPlus ? 1 : -1;
        if (tierA.isTierA !== tierB.isTierA) return tierB.isTierA ? 1 : -1;

        const isWhaleA = tierA.toVal >= 2000000 ? 1 : 0;
        const isWhaleB = tierB.toVal >= 2000000 ? 1 : 0;
        if (isWhaleA !== isWhaleB) return isWhaleB - isWhaleA;

        const fusionA = isFreshRiderPick(a) && getHotThemes(a.name).length > 0;
        const fusionB = isFreshRiderPick(b) && getHotThemes(b.name).length > 0;
        if (fusionA !== fusionB) return fusionA ? -1 : 1;

        if (fa !== fb) return fa - fb;
        if (tierA.tightValNum !== tierB.tightValNum) return tierA.tightValNum - tierB.tightValNum;
        if (tierA.fDistVal !== tierB.fDistVal) return tierA.fDistVal - tierB.fDistVal;

        const pa = a.pullback ?? 99, pb = b.pullback ?? 99;
        if (pa !== pb) return pa - pb;

        return tierB.toVal - tierA.toVal;
    });

    htOut.sort((a, b) => {
        const tierA = a._tier;
        const tierB = b._tier;
        const fa = a._freshness, fb = b._freshness;

        if (fa !== fb) {
            if (fa === 0 || fb === 0) return fa - fb;
        }
        if (tierA.isTierAPlus !== tierB.isTierAPlus) return tierB.isTierAPlus ? 1 : -1;
        if (tierA.isTierA !== tierB.isTierA) return tierB.isTierA ? 1 : -1;

        const isWhaleA = tierA.toVal >= 2000000 ? 1 : 0;
        const isWhaleB = tierB.toVal >= 2000000 ? 1 : 0;
        if (isWhaleA !== isWhaleB) return isWhaleB - isWhaleA;

        const fusionA = isFreshRiderPick(a) && getHotThemes(a.name).length > 0;
        const fusionB = isFreshRiderPick(b) && getHotThemes(b.name).length > 0;
        if (fusionA !== fusionB) return fusionA ? -1 : 1;

        const ca = a.confluence || 0, cb = b.confluence || 0;
        if (ca !== cb) return cb - ca;

        if (tierA.tightValNum !== tierB.tightValNum) return tierA.tightValNum - tierB.tightValNum;
        if (tierA.fDistVal !== tierB.fDistVal) return tierA.fDistVal - tierB.fDistVal;

        const pa = a.pullback ?? 99, pb = b.pullback ?? 99;
        if (pa !== pb) return pa - pb;

        return tierB.toVal - tierA.toVal;
    });
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

    // 7b. Semak Corporate News & Dividen Automatik untuk Top Ranking
    console.log('📣 Semakan Berita Korporat & Tarikh Ex-Dividen Automatik...');
    const { getCorporateNewsRisk } = require('./fetch_news_module');
    const symbolMap = fs.existsSync(path.join(path.join(__dirname, '..'), 'symbol_mappings.json')) 
        ? JSON.parse(fs.readFileSync(path.join(path.join(__dirname, '..'), 'symbol_mappings.json'), 'utf8')) 
        : {};

    async function enrichListWithNews(list) {
        for (const item of list) {
            let code = item.code || '';
            if (!code && symbolMap[item.name.toUpperCase()]) {
                code = symbolMap[item.name.toUpperCase()].replace(/\.KL$/i, '');
            }
            if (code) {
                const newsData = await getCorporateNewsRisk(code, item.name);
                item.newsAlert = newsData.hasNewsAlert;
                item.newsBadges = newsData.newsBadges;
                item.announcements = newsData.announcements;
                item.entitlements = newsData.entitlements;
            } else {
                item.newsAlert = false;
                item.newsBadges = [];
            }
        }
    }

    await enrichListWithNews(frOut);
    await enrichListWithNews(htOut);
    console.log('✅ Semakan Berita & Ex-Dividen selesai untuk senarai signal.');

    // 8. Format & hantar
    const out = {
        generatedAt: now.toISOString(),
        dataTime,
        freshRider: { list: frOut, newCount: frOut.filter(s => s.label && s.label.includes('NEW')).length, reentryCount: frOut.filter(s => s.label === '🟢 RE-ENTRY').length, addonCount: frOut.filter(s => s.label === '➕ ADD-ON').length },
        hotTheme: { list: htOut, newCount: htOut.filter(s => s.label && s.label.includes('NEW')).length, reentryCount: htOut.filter(s => s.label === '🟢 RE-ENTRY').length, addonCount: htOut.filter(s => s.label === '➕ ADD-ON').length },
        slWarnings,
        frTracked: frTrades.length,
        htTracked: htTrades.length,
    };
    const msg = buildMessage(now, out);

    // Simpan output untuk rujukan
    fs.writeFileSync(path.join(path.join(__dirname, '..'), 'buy_alert_latest.json'), JSON.stringify(out, null, 2), 'utf8');
    console.log('\n' + msg + '\n');

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
        try {
            const mytNow = new Date(now.getTime() + 8 * 3600 * 1000);
            const mytDate = mytNow.toISOString().slice(0, 10);
            const mytHour = mytNow.getUTCHours();

            if (!isTradingDay(mytDate)) {
                console.log(`🌙 [Telegram Guard] ${mytDate} bukan hari dagangan Bursa Malaysia — notifikasi Telegram diskip.`);
                return;
            }

            // Elak mesej sampai lewat malam akibat GitHub Actions cron delay
            if (mytHour >= 21) {
                console.warn(`⏳ [Telegram Guard] Waktu sudah melepasi 9:00 PM MYT (${mytHour}:00). Notifikasi disekat untuk elak mesej basi.`);
                return;
            }

            // Pecahkan mesej jika melebihi had 4096 aksara Telegram
            const chunks = [];
            if (msg.length <= 3800) {
                chunks.push(msg);
            } else {
                const lines = msg.split('\n');
                let cur = '';
                for (const l of lines) {
                    if ((cur + '\n' + l).length > 3800) {
                        if (cur) chunks.push(cur);
                        cur = l;
                    } else {
                        cur = cur ? cur + '\n' + l : l;
                    }
                }
                if (cur) chunks.push(cur);
            }

            async function sendTelegramMessage(t, c, textPart) {
                try {
                    const out = execFileSync('curl', [
                        '-4', '-s', '--max-time', '15', '-X', 'POST',
                        `https://api.telegram.org/bot${t}/sendMessage`,
                        '-H', 'Content-Type: application/json',
                        '-d', JSON.stringify({ chat_id: c, text: textPart })
                    ], { encoding: 'utf8' });
                    const res = JSON.parse(out);
                    if (res && res.ok) return res;
                } catch (e) {
                    // Fallback to https.request
                }

                const url = `https://api.telegram.org/bot${t}/sendMessage`;
                const body = JSON.stringify({ chat_id: c, text: textPart });
                return new Promise((resolve, reject) => {
                    const req = https.request(url, {
                        family: 4,
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
            }

            console.log(`📤 Menghantar ${chunks.length} bahagian mesej ke Telegram...`);
            for (let i = 0; i < chunks.length; i++) {
                const part = chunks[i];
                const r = await sendTelegramMessage(token, chatId, part);
                if (r && r.ok) {
                    console.log(`✅ Telegram: bahagian ${i + 1}/${chunks.length} berjaya dihantar.`);
                } else {
                    console.error(`❌ Telegram gagal (bahagian ${i + 1}):`, JSON.stringify(r));
                }
                if (i < chunks.length - 1) {
                    await new Promise(res => setTimeout(res, 800));
                }
            }
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
