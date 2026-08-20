// =============================================================
// HOT THEME TRACKER GENERATOR (Semiconductor & Solar/RE)
// Entry: Confluence 2+ strategi DAN sektor = Semicon/Solar
// Exit: Hybrid Trail 20/6 + Hard Stop -12%
// Backtest 61 hari: 23 signal | WR 83% | avg +13.3% | total +305.7% | worst -5.3%
// Output: window.HOT_THEME_TRACKER dalam hot_theme_tracker.js
// =============================================================
const fs = require('fs');
const path = require('path');

const HIST_DIR = path.join(__dirname, 'history');
const OUT_FILE = path.join(__dirname, 'hot_theme_tracker.js');

// ---- Kanonikalkan nama stok ikut symbol_mappings.json ----
// Sebab: feed boleh guna nama berbeza untuk syarikat sama (cth. "SRKKAI" dulu, "SRKK" sekarang) —
// tanpa ini satu saham boleh ditrack DUA kali (duplicate position + harga beku).
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

// ---- Tema mapping ----
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

// ---- Strategy filters (sama macam index.html) ----
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

// ---- Hot Theme Pick ----
function isHotThemePick(item) {
    if (!item || !item.name || item.price <= 0 || item.price > 10.0) return false;
    if (isSleepingOrAvoidStock(item) || item.isCombStock) return false;
    const themes = getHotThemes(item.name);
    if (themes.length === 0) return false;
    if (item.hasVolumeSpike === true) return false; // CS MERAH sahaja — buang entry hari volum spike (breakout/expansion)
    return confluenceCount(item) >= 2;
}

// ---- Hari dagangan sebenar (buang snapshot hujung minggu) ----
// Snapshot Sabtu/Ahad wujud bila scraper jalan manual/luar waktu — ia cuma
// data stale hari dagangan terakhir. Tanpa filter ini, entry direkod pada
// hari pasaran tutup.
function isTradingDay(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const wd = d.getDay();
    return wd !== 0 && wd !== 6; // bukan Ahad (0) / Sabtu (6)
}

// ---- Load history ----
const files = fs.readdirSync(HIST_DIR).filter(f => /^data_.*\.json$/.test(f))
    .filter(f => isTradingDay(f.replace('data_', '').replace('.json', '')))
    .sort();
const allData = {};
for (const f of files) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(HIST_DIR, f), 'utf8')); } catch (e) { continue; }
    const list = Array.isArray(d) ? d : (d.topVolume || []);
    const date = f.replace('data_', '').replace('.json', '');
    allData[date] = {};
    for (const it of list) { if (it && it.name && it.price > 0 && it.price < 500) allData[date][it.name] = it; }
}
const dates = Object.keys(allData).sort();

// ---- Live data ----
const liveFile = path.join(__dirname, 'live_data.json');
let liveData = null;
if (fs.existsSync(liveFile)) {
    try { liveData = JSON.parse(fs.readFileSync(liveFile, 'utf8')); } catch (e) { /* abaikan */ }
}

// Gabung history + live
const dayList = dates.map(d => ({ date: d, rows: Object.values(allData[d]) }));
if (liveData && liveData.topVolume) {
    const today = (liveData.lastUpdated || '').slice(0, 10);
    if (today && isTradingDay(today) && (!dayList.length || dayList[dayList.length - 1].date !== today)) {
        dayList.push({ date: today, rows: liveData.topVolume, isLive: true });
    }
}

// ---- Replay: track semua trade ----
const open = {};
const trades = [];

// Lantai dinamik (sama macam list di index.html): selepas breakout (>10% atas lantai asal),
// guna lantai BARU = minimum harga 5 hari dagangan terakhir, bukan floorLow yang ketinggalan
// jauh di bawah. Penting: hotThemeExit guna currentFloor untuk floorSL — lantai baru = SL lebih ketat.
const recentByName = {}; // name -> harga beberapa hari sebelum hari semasa
function dynamicFloor(name, price, floorLow) {
    const rfArr = recentByName[name] || [];
    const rf = rfArr.length ? Math.min(...rfArr) : 0;
    const f = floorLow || 0;
    if (f > 0 && rf > 0 && ((price - f) / f) > 0.10) return Math.max(f, rf);
    return f || rf;
}

function hotThemeExit(t, price) {
    const floorSL = (t.currentFloor || t.entryFloor) * 0.97;
    const gain = ((t.high - t.entry) / t.entry) * 100;
    const trailSL = gain >= 20 ? t.high * 0.94 : t.high * 0.80;
    // Hard stop -16% selepas 5 hari (sweep: 703.7 vs hard12 681.7 — AMS terselamat, semua rugi ditutup)
    const hardStop = t.days > 5 ? t.entry * 0.84 : 0;
    return Math.max(floorSL, trailSL, hardStop);
}

for (const day of dayList) {
    const map = {};
    for (const it of day.rows) if (it && it.name && it.price > 0) map[canonName(it.name).toUpperCase()] = it;

    // Update open trades
    for (const [name, t] of Object.entries(open)) {
        const cur = map[name];
        if (!cur || cur.price <= 0) continue;
        // Skip data anomaly: harga melonjak > 50% sehari (contoh: NE 13 Jul 2026)
        const dayChange = cur.price / t.currentPrice;
        if (dayChange > 1.5 || dayChange < 0.5) continue;
        t.days++;
        t.lastDate = day.date;
        t.currentPrice = cur.price;
        if (cur.floorLow) t.currentFloor = +dynamicFloor(name, cur.price, cur.floorLow).toFixed(3);
        if (cur.price > t.high) { t.high = cur.price; t.highDate = day.date; }
        t.maxGain = +(((t.high - t.entry) / t.entry) * 100).toFixed(1);

        const sl = hotThemeExit(t, cur.price);
        t.slTrail = +sl.toFixed(3);
        if (cur.price <= sl) {
            t.status = 'CLOSED_SL';
            t.exitDate = day.date;
            t.exitPrice = sl;
            t.finalGain = +(((sl - t.entry) / t.entry) * 100).toFixed(1);
            delete open[name];
        } else {
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
        }
    }

    // Entry baru
    for (const it of day.rows) {
        if (!it || !it.name || it.price <= 0) continue;
        const name = canonName(it.name).toUpperCase();
        if (open[name] || trades.some(t => t.name.toUpperCase() === name)) continue;
        if (!isHotThemePick(it)) continue;
        const t = {
            name: canonName(it.name),
            entryDate: day.date,
            entry: +it.price.toFixed(3),
            entryFloor: +dynamicFloor(name, it.price, it.floorLow || it.price * 0.95).toFixed(3),
            currentFloor: +dynamicFloor(name, it.price, it.floorLow || it.price * 0.95).toFixed(3),
            currentPrice: +it.price.toFixed(3),
            high: +it.price.toFixed(3),
            highDate: day.date,
            maxGain: 0,
            finalGain: 0,
            days: 1,
            lastDate: day.date,
            status: 'OPEN',
            themes: getHotThemes(it.name),
            confluence: confluenceCount(it),
        };
        open[name] = t;
        trades.push(t);
    }

    // Rekod harga hari ini (untuk lantai dinamik hari seterusnya)
    for (const [nm, it] of Object.entries(map)) {
        if (!recentByName[nm]) recentByName[nm] = [];
        recentByName[nm].push(it.price);
        if (recentByName[nm].length > 5) recentByName[nm].shift();
    }
}

// ---- Backfill harga terkini untuk posisi beku (keluar dari top-volume) ----
// Posisi OPEN hanya dikemas kini bila saham ADA dalam senarai top-volume harian.
// Bila saham keluar dari senarai (cth. MI, SAM, NE, SAMAIDEN), harga "kini" beku
// dan PnL jadi salah. Backfill harga dari Yahoo ikut symbol yang disahkan.
const { backfillStaleTrades } = require('./backfill_stale.js');
const latestDay = dayList.length ? dayList[dayList.length - 1].date : '';
const backfilled = backfillStaleTrades(trades, latestDay, hotThemeExit);
if (backfilled) console.log(`\n🔄 ${backfilled} posisi beku dikemas kini dari Yahoo`);

// Susun: OPEN dulu, kemudian CLOSED
const openTrades = trades.filter(t => t.status === 'OPEN').sort((a, b) => b.entryDate.localeCompare(a.entryDate));
const closedTrades = trades.filter(t => t.status !== 'OPEN').sort((a, b) => b.exitDate.localeCompare(a.exitDate));
const all = [...openTrades, ...closedTrades];

// Statistik
const wins = closedTrades.filter(t => t.finalGain > 0).length;
const openPnl = openTrades.reduce((a, b) => a + (b.finalGain || 0), 0);
const closedPnl = closedTrades.reduce((a, b) => a + (b.finalGain || 0), 0);
const summary = {
    generatedAt: new Date().toISOString(),
    dataDays: dayList.length,
    totalTracked: trades.length,
    openCount: openTrades.length,
    closedCount: closedTrades.length,
    closedWins: wins,
    closedWinRate: closedTrades.length ? Math.round(100 * wins / closedTrades.length) : 0,
    closedAvgGain: closedTrades.length ? +(closedTrades.reduce((a, b) => a + b.finalGain, 0) / closedTrades.length).toFixed(1) : 0,
    openPnl: +openPnl.toFixed(1),
    closedPnl: +closedPnl.toFixed(1),
    totalPnlNow: +(openPnl + closedPnl).toFixed(1),
};

// ---- Backtest 20-hari (exit paksa) ----
function bt20(entry, floor, fut) {
    let high = entry, curFloor = floor;
    for (const d of fut) {
        if (d.price > high) high = d.price;
        if (d.floorLow) curFloor = d.floorLow;
        const floorSL = curFloor * 0.97;
        const gain = ((high - entry) / entry) * 100;
        const trail = gain >= 20 ? high * 0.94 : high * 0.80;
        const sl = Math.max(floorSL, trail, entry * 0.84);
        if (d.price <= sl) return ((sl - entry) / entry) * 100;
    }
    return ((fut[fut.length - 1].price - entry) / entry) * 100;
}
const btSeen = new Set();
const btRets = [];
for (let i = 0; i < dayList.length - 3; i++) {
    const dayMap = {};
    for (const it of dayList[i].rows) if (it && it.name && it.price > 0 && it.price < 500) dayMap[canonName(it.name)] = it;
    for (const [name, item] of Object.entries(dayMap)) {
        if (btSeen.has(name) || item.price < 0.10) continue;
        if (!isHotThemePick(item)) continue;
        btSeen.add(name);
        const fut = [];
        let prev = item.price, ok = true;
        for (let j = i + 1; j < Math.min(dayList.length, i + 1 + 20); j++) {
            const m = dayList[j].rows.find(r => r && canonName(r.name) === name && r.price > 0);
            if (m) {
                const r = m.price / prev;
                if (r > 1.5 || r < 0.5) { ok = false; break; }
                fut.push({ price: m.price, floorLow: m.floorLow });
                prev = m.price;
            }
        }
        if (!ok || !fut.length) continue;
        btRets.push(bt20(item.price, item.floorLow || item.price * 0.95, fut));
    }
}
const btWins = btRets.filter(r => r > 0).length;
const backtest = {
    dataStart: dayList[0].date,
    dataEnd: dayList[dayList.length - 1].date,
    dataDays: dayList.length,
    signals: btRets.length,
    winRate: btRets.length ? Math.round(100 * btWins / btRets.length) : 0,
    avgGain: btRets.length ? +(btRets.reduce((a, b) => a + b, 0) / btRets.length).toFixed(1) : 0,
    totalPnl: btRets.length ? +btRets.reduce((a, b) => a + b, 0).toFixed(1) : 0,
    worstLoss: btRets.length ? +Math.min(...btRets).toFixed(1) : 0,
};

// ---- Theme Rotation Detector ----
// Kira "theme strength" setiap hari: berapa % top volume adalah kaunter tema
const themeStrength = [];
for (const day of dayList) {
    let themeVol = 0, totalVol = 0;
    for (const it of day.rows) {
        if (!it || !it.name || it.price <= 0) continue;
        const vol = (it.turnover || 0) * (it.price || 1);
        totalVol += vol;
        if (getHotThemes(it.name).length > 0) themeVol += vol;
    }
    themeStrength.push({
        date: day.date,
        themePct: totalVol > 0 ? +(themeVol / totalVol * 100).toFixed(1) : 0,
        themeCount: day.rows.filter(it => it && it.name && getHotThemes(it.name).length > 0).length,
        totalCount: day.rows.filter(it => it && it.name && it.price > 0).length,
    });
}
// 5-day moving average
for (let i = 0; i < themeStrength.length; i++) {
    const start = Math.max(0, i - 4);
    const slice = themeStrength.slice(start, i + 1);
    themeStrength[i].ma5 = +(slice.reduce((a, b) => a + b.themePct, 0) / slice.length).toFixed(1);
}
// Trend: rising = warming up
const recent5 = themeStrength.slice(-5);
const themeTrend = recent5.length >= 2 && recent5[recent5.length - 1].ma5 > recent5[0].ma5 ? 'RISING' : 'FLAT/FALLING';

const js = `// AUTO-GENERATED oleh generate_hot_theme_tracker.js — jangan edit manual\nwindow.HOT_THEME_TRACKER = ${JSON.stringify({ summary, backtest, themeStrength, themeTrend, trades: all }, null, 1)};\n`;
fs.writeFileSync(OUT_FILE, js);

console.log(`✅ Hot Theme Tracker dijana: ${OUT_FILE}`);
console.log(`   Data: ${dayList.length} hari (${dayList[0].date} -> ${dayList[dayList.length - 1].date})`);
console.log(`   Total: ${summary.totalTracked} | OPEN: ${summary.openCount} | CLOSED: ${summary.closedCount} (WR ${summary.closedWinRate}%, avg ${summary.closedAvgGain}%)`);
console.log(`   Backtest 20h: ${backtest.signals} signal | WR ${backtest.winRate}% | avg ${backtest.avgGain}% | total ${backtest.totalPnl}% | worst ${backtest.worstLoss}%`);
console.log(`   Theme Trend: ${themeTrend} (strength 5h terakhir: ${recent5.map(r => r.ma5 + '%').join(' -> ')})`);
console.log('\n--- MASIH OPEN ---');
openTrades.forEach(t => console.log(`   ${t.name.padEnd(12)} entry ${t.entryDate} @ RM${t.entry} | kini RM${t.currentPrice} (${t.finalGain >= 0 ? '+' : ''}${t.finalGain}%) | max +${t.maxGain}% | ${t.days} hari | ${t.themes.join(',')}`));
console.log('\n--- CLOSED ---');
closedTrades.forEach(t => console.log(`   ${t.name.padEnd(12)} ${t.entryDate} -> ${t.exitDate} | ${t.finalGain >= 0 ? '+' : ''}${t.finalGain}% (max +${t.maxGain}%) | ${t.status}`));
