// =============================================================
// FRESH RIDER TRACKER GENERATOR
// Replay semua data history + live, kesan setiap kaunter yang qualify
// Fresh VVIP Rider, track sampai EXIT (RIDE floor) atau kekal OPEN.
// Output: window.FRESH_RIDER_TRACKER dalam fresh_rider_tracker.js
// =============================================================
const fs = require('fs');
const path = require('path');

const HIST_DIR = path.join(__dirname, 'history');
const OUT_FILE = path.join(__dirname, 'fresh_rider_tracker.js');

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

// ---- Rule Fresh VVIP Rider (A5) — sama macam index.html ----
function isFreshRiderPick(item) {
    return item.isVvip === true && item.signal !== 'avoid' && !item.isCombStock
        && (item.ipoYear || 0) >= 2025 && (item.pullback ?? 99) <= 10 && (item.closeTightness ?? 99) <= 5.0
        && item.price >= 0.10 && item.price <= 50
        && item.hasVolumeSpike !== true; // CS MERAH sahaja — buang entry hari volum spike (breakout/expansion)
}

// ---- Hari dagangan sebenar (buang snapshot hujung minggu) ----
// Snapshot Sabtu/Ahad wujud bila scraper jalan manual/luar waktu — ia cuma
// data stale hari dagangan terakhir. Tanpa filter ini, entry direkod pada
// hari pasaran tutup (cth. MTTSL "entry 2-Ogos-Ahad" sedangkan sepatutnya 3-Ogos-Isnin).
function isTradingDay(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const wd = d.getDay();
    return wd !== 0 && wd !== 6; // bukan Ahad (0) / Sabtu (6)
}

// ---- Kumpul semua hari (history + live_data.json sebagai hari terkini) ----
const files = fs.readdirSync(HIST_DIR).filter(f => /^data_.*\.json$/.test(f))
    .filter(f => fs.statSync(path.join(HIST_DIR, f)).size > 100000)
    .filter(f => isTradingDay(f.replace('data_', '').replace('.json', '')))
    .sort();

const dayList = [];
for (const f of files) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(HIST_DIR, f), 'utf8')); } catch (e) { continue; }
    dayList.push({ date: f.replace('data_', '').replace('.json', ''), rows: d.topVolume || [] });
}
// Live data = hari semasa (jika tarikh berbeza dari history terakhir)
const liveFile = path.join(__dirname, 'live_data.json');
if (fs.existsSync(liveFile)) {
    try {
        const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
        const today = (live.lastUpdated || '').slice(0, 10);
        if (today && isTradingDay(today) && (!dayList.length || dayList[dayList.length - 1].date !== today)) {
            dayList.push({ date: today, rows: live.topVolume || [], isLive: true });
        }
    } catch (e) { /* abaikan */ }
}

// ---- Replay: masuk bila qualify, track sampai exit ----
const open = {};   // name -> trade state
const trades = []; // semua trade (open + closed)

// Lantai dinamik (sama macam list di index.html): selepas breakout (>10% atas lantai asal),
// guna lantai BARU = minimum harga 5 hari dagangan terakhir, bukan floorLow yang ketinggalan
// jauh di bawah (cth. AMBEST lantai asal 0.92 tapi lantai baru 1.09).
const recentByName = {}; // name -> harga beberapa hari sebelum hari semasa
function dynamicFloor(name, price, floorLow) {
    const rfArr = recentByName[name] || [];
    const rf = rfArr.length ? Math.min(...rfArr) : 0;
    const f = floorLow || 0;
    if (f > 0 && rf > 0 && ((price - f) / f) > 0.10) return Math.max(f, rf);
    return f || rf;
}

for (const day of dayList) {
    const map = {};
    for (const it of day.rows) if (it && it.name && it.price > 0) map[canonName(it.name).toUpperCase()] = it;

    // 1) Update trade OPEN: semak exit / rekod high
    for (const [name, t] of Object.entries(open)) {
        const cur = map[name];
        if (!cur || cur.price <= 0) continue; // tiada data hari ni, skip
        t.days++;
        t.lastDate = day.date;
        t.currentPrice = cur.price;
        if (cur.floorLow) t.currentFloor = +dynamicFloor(name, cur.price, cur.floorLow).toFixed(3);
        if (cur.price > t.high) { t.high = cur.price; t.highDate = day.date; }
        t.maxGain = +(((t.high - t.entry) / t.entry) * 100).toFixed(1);

        // EXIT: (1) Initial Floor SL (3% bawah lantai asal jika bocor awal) ATAU (2) Trail 20% dari HIGH
        const initialSl = (t.entryFloor || t.entry * 0.95) * 0.97;
        const slTrail = Math.max(initialSl, t.high * 0.80);
        t.slTrail = +slTrail.toFixed(3);
        if (cur.price <= slTrail) {
            t.status = 'CLOSED_SL';
            t.exitDate = day.date;
            t.exitPrice = +cur.price.toFixed(3);
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
            delete open[name];
        } else {
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
        }
    }

    // 2) Entry baru: qualify hari ini & belum pernah ditrack
    for (const it of day.rows) {
        if (!it || !it.name || it.price <= 0) continue;
        const name = canonName(it.name).toUpperCase();
        if (open[name] || trades.some(t => t.name.toUpperCase() === name)) continue; // dedup: satu kaunter satu trade
        if (!isFreshRiderPick(it)) continue;
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
            ipoYear: it.ipoYear || null,
            sector: it.sector || '',
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
// Bila saham keluar dari senarai, harga "kini" beku dan PnL jadi salah.
// Backfill harga dari Yahoo ikut symbol yang disahkan (sama macam Hot Theme).
const { backfillStaleTrades } = require('./backfill_stale.js');
const latestDay = dayList.length ? dayList[dayList.length - 1].date : '';
const backfilled = backfillStaleTrades(trades, latestDay, (t) => t.high * 0.80);
if (backfilled) console.log(`\n🔄 ${backfilled} posisi beku dikemas kini dari Yahoo`);

// Susun: OPEN dulu (latest entry atas), kemudian CLOSED
const openTrades = trades.filter(t => t.status === 'OPEN').sort((a, b) => b.entryDate.localeCompare(a.entryDate));
const closedTrades = trades.filter(t => t.status !== 'OPEN').sort((a, b) => b.exitDate.localeCompare(a.exitDate));
const all = [...openTrades, ...closedTrades];

// Statistik ringkas
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

// =============================================================
// BACKTEST 20-hari (exit paksa) — dikira semula setiap hari supaya
// statistik sentiasa terkini (bukan kekal 11 Ogos).
// =============================================================
function rideFloor20(entry, floor, fut) {
    for (const d of fut) {
        const g = ((d.price - entry) / entry) * 100;
        const f = d.floorLow || floor;
        if (d.price <= floor * 0.97) return ((floor * 0.97 - entry) / entry) * 100;
        if (d.price < f * 0.995) return g;
    }
    return ((fut[fut.length - 1].price - entry) / entry) * 100;
}
const dateMap = dayList.map(d => {
    const m = {};
    for (const it of d.rows) if (it && it.name && it.price > 0 && it.price < 500) m[canonName(it.name)] = it;
    return { date: d.date, map: m };
});
const btSeen = new Set();
const btRets = [];
for (let i = 0; i < dateMap.length - 3; i++) {
    for (const [name, item] of Object.entries(dateMap[i].map)) {
        if (btSeen.has(name) || item.price < 0.10) continue;
        if (!isFreshRiderPick(item)) continue;
        btSeen.add(name);
        // kumpul 20 hari ke depan
        const fut = [];
        let prev = item.price;
        let ok = true;
        for (let j = i + 1; j < Math.min(dateMap.length, i + 1 + 20); j++) {
            const m = dateMap[j].map[name];
            if (m && m.price > 0) {
                const r = m.price / prev;
                if (r > 1.5 || r < 0.5) { ok = false; break; }
                fut.push({ price: m.price, floorLow: m.floorLow });
                prev = m.price;
            }
        }
        if (!ok || !fut.length) continue;
        btRets.push(rideFloor20(item.price, item.floorLow || item.price * 0.95, fut));
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

const js = `// AUTO-GENERATED oleh generate_fresh_rider_tracker.js — jangan edit manual\nwindow.FRESH_RIDER_TRACKER = ${JSON.stringify({ summary, backtest, trades: all }, null, 1)};\n`;
fs.writeFileSync(OUT_FILE, js);

console.log(`✅ Tracker dijana: ${OUT_FILE}`);
console.log(`   Data: ${dayList.length} hari (${dayList[0].date} -> ${dayList[dayList.length - 1].date})`);
console.log(`   Total: ${summary.totalTracked} | OPEN: ${summary.openCount} | CLOSED: ${summary.closedCount} (WR ${summary.closedWinRate}%, avg ${summary.closedAvgGain}%)`);
console.log(`   Backtest 20h: ${backtest.signals} signal | WR ${backtest.winRate}% | avg ${backtest.avgGain}% | total ${backtest.totalPnl}% | worst ${backtest.worstLoss}%`);
console.log('\n--- MASIH OPEN ---');
openTrades.forEach(t => console.log(`   ${t.name.padEnd(12)} entry ${t.entryDate} @ RM${t.entry} | kini RM${t.currentPrice} (${t.finalGain >= 0 ? '+' : ''}${t.finalGain}%) | max +${t.maxGain}% | ${t.days} hari`));
console.log('\n--- CLOSED ---');
closedTrades.forEach(t => console.log(`   ${t.name.padEnd(12)} ${t.entryDate} -> ${t.exitDate} | ${t.finalGain >= 0 ? '+' : ''}${t.finalGain}% (max +${t.maxGain}%) | ${t.status}`));
