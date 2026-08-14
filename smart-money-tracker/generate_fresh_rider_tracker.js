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

// ---- Rule Fresh VVIP Rider (A5) — sama macam index.html ----
function isFreshRiderPick(item) {
    return item.isVvip === true && item.signal !== 'avoid' && !item.isCombStock
        && (item.ipoYear || 0) >= 2025 && (item.pullback ?? 99) <= 10 && (item.closeTightness ?? 99) <= 5.0
        && item.price >= 0.10 && item.price <= 50;
}

// ---- Kumpul semua hari (history + live_data.json sebagai hari terkini) ----
const files = fs.readdirSync(HIST_DIR).filter(f => /^data_.*\.json$/.test(f))
    .filter(f => fs.statSync(path.join(HIST_DIR, f)).size > 100000).sort();

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
        if (today && (!dayList.length || dayList[dayList.length - 1].date !== today)) {
            dayList.push({ date: today, rows: live.topVolume || [], isLive: true });
        }
    } catch (e) { /* abaikan */ }
}

// ---- Replay: masuk bila qualify, track sampai exit ----
const open = {};   // name -> trade state
const trades = []; // semua trade (open + closed)

for (const day of dayList) {
    const map = {};
    for (const it of day.rows) if (it && it.name && it.price > 0) map[it.name.toUpperCase()] = it;

    // 1) Update trade OPEN: semak exit / rekod high
    for (const [name, t] of Object.entries(open)) {
        const cur = map[name];
        if (!cur || cur.price <= 0) continue; // tiada data hari ni, skip
        t.days++;
        t.lastDate = day.date;
        t.currentPrice = cur.price;
        if (cur.floorLow) t.currentFloor = cur.floorLow;
        if (cur.price > t.high) { t.high = cur.price; t.highDate = day.date; }
        t.maxGain = +(((t.high - t.entry) / t.entry) * 100).toFixed(1);

        // EXIT: TRAIL 20% dari harga TERTINGGI (high) sejak entry.
        // Ini cara standard trend-following — biar keuntungan berlari, keluar hanya
        // bila harga jatuh 20% dari puncak. Lantai harian terlalu volatile untuk SL.
        // (Ujian: trail 20% dari high kekalkan semua pemenang, exit HKB +39% sebelum runtuh.)
        const slTrail = t.high * 0.80;
        t.slTrail = +slTrail.toFixed(3);
        if (cur.price <= slTrail) {
            t.status = 'CLOSED_SL';
            t.exitDate = day.date;
            t.exitPrice = slTrail;
            t.finalGain = +(((slTrail - t.entry) / t.entry) * 100).toFixed(1);
            delete open[name];
        } else {
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
        }
    }

    // 2) Entry baru: qualify hari ini & belum pernah ditrack
    for (const it of day.rows) {
        if (!it || !it.name || it.price <= 0) continue;
        const name = it.name.toUpperCase();
        if (open[name] || trades.some(t => t.name === name)) continue; // dedup: satu kaunter satu trade
        if (!isFreshRiderPick(it)) continue;
        const t = {
            name: it.name,
            entryDate: day.date,
            entry: +it.price.toFixed(3),
            entryFloor: +(it.floorLow || it.price * 0.95).toFixed(3),
            currentFloor: +(it.floorLow || it.price * 0.95).toFixed(3),
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
}

// Susun: OPEN dulu (latest entry atas), kemudian CLOSED
const openTrades = trades.filter(t => t.status === 'OPEN').sort((a, b) => b.entryDate.localeCompare(a.entryDate));
const closedTrades = trades.filter(t => t.status !== 'OPEN').sort((a, b) => b.exitDate.localeCompare(a.exitDate));
const all = [...openTrades, ...closedTrades];

// Statistik ringkas
const wins = closedTrades.filter(t => t.finalGain > 0).length;
const summary = {
    generatedAt: new Date().toISOString(),
    dataDays: dayList.length,
    totalTracked: trades.length,
    openCount: openTrades.length,
    closedCount: closedTrades.length,
    closedWins: wins,
    closedWinRate: closedTrades.length ? Math.round(100 * wins / closedTrades.length) : 0,
    closedAvgGain: closedTrades.length ? +(closedTrades.reduce((a, b) => a + b.finalGain, 0) / closedTrades.length).toFixed(1) : 0,
};

const js = `// AUTO-GENERATED oleh generate_fresh_rider_tracker.js — jangan edit manual\nwindow.FRESH_RIDER_TRACKER = ${JSON.stringify({ summary, trades: all }, null, 1)};\n`;
fs.writeFileSync(OUT_FILE, js);

console.log(`✅ Tracker dijana: ${OUT_FILE}`);
console.log(`   Data: ${dayList.length} hari (${dayList[0].date} -> ${dayList[dayList.length - 1].date})`);
console.log(`   Total: ${summary.totalTracked} | OPEN: ${summary.openCount} | CLOSED: ${summary.closedCount} (WR ${summary.closedWinRate}%, avg ${summary.closedAvgGain}%)`);
console.log('\n--- MASIH OPEN ---');
openTrades.forEach(t => console.log(`   ${t.name.padEnd(12)} entry ${t.entryDate} @ RM${t.entry} | kini RM${t.currentPrice} (${t.finalGain >= 0 ? '+' : ''}${t.finalGain}%) | max +${t.maxGain}% | ${t.days} hari`));
console.log('\n--- CLOSED ---');
closedTrades.forEach(t => console.log(`   ${t.name.padEnd(12)} ${t.entryDate} -> ${t.exitDate} | ${t.finalGain >= 0 ? '+' : ''}${t.finalGain}% (max +${t.maxGain}%) | ${t.status}`));
