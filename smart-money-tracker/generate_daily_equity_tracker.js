// =============================================================
// DAILY PORTFOLIO EQUITY & SNAPSHOT GENERATOR
// Replay setiap hari dagangan dari data history:
// Mengira nilai snapshot PnL portfolio, senarai posisi aktif,
// dan pergerakan harga sebenar pada setiap tarikh.
// Output: window.DAILY_EQUITY_TRACKER dalam daily_equity_tracker.js
// =============================================================
const fs = require('fs');
const path = require('path');

const ROOT_DIR = '/home/awi/Desktop/trade/BSKL/smart-money-tracker';
const HIST_DIR = path.join(ROOT_DIR, 'history');
const OUT_FILE = path.join(ROOT_DIR, 'daily_equity_tracker.js');

// 1. Muatkan signal trade dari Fresh Rider & Hot Theme
global.window = {};
require(path.join(ROOT_DIR, 'fresh_rider_tracker.js'));
require(path.join(ROOT_DIR, 'hot_theme_tracker.js'));

const frTrades = (window.FRESH_RIDER_TRACKER.trades || []).map(t => ({
    ...t,
    trackerType: 'FR',
    trackerTitle: 'Fresh Rider',
    badgeColor: '#fde047',
    badgeBg: 'rgba(253, 224, 71, 0.15)',
    badgeBorder: 'rgba(253, 224, 71, 0.4)'
}));

const htTrades = (window.HOT_THEME_TRACKER.trades || []).map(t => ({
    ...t,
    trackerType: 'HT',
    trackerTitle: 'Hot Theme',
    badgeColor: '#c4b5fd',
    badgeBg: 'rgba(196, 181, 253, 0.15)',
    badgeBorder: 'rgba(196, 181, 253, 0.4)'
}));

const allTrades = [...frTrades, ...htTrades];

// 2. Kumpul fail history
function isTradingDay(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const wd = d.getDay();
    return wd !== 0 && wd !== 6;
}

const files = fs.readdirSync(HIST_DIR).filter(f => /^data_.*\.json$/.test(f))
    .filter(f => fs.statSync(path.join(HIST_DIR, f)).size > 50000)
    .filter(f => isTradingDay(f.replace('data_', '').replace('.json', '')))
    .sort();

const historyDays = [];
files.forEach(f => {
    const dateStr = f.replace('data_', '').replace('.json', '');
    try {
        const d = JSON.parse(fs.readFileSync(path.join(HIST_DIR, f), 'utf8'));
        const rows = d.topVolume || [];
        if (rows.length > 50) {
            const map = {};
            rows.forEach(r => {
                if (r && r.name && r.price > 0) map[r.name.toUpperCase().trim()] = r;
            });
            historyDays.push({ date: dateStr, map, raw: rows });
        }
    } catch (e) {}
});

// Live data = hari semasa
const livePath = path.join(ROOT_DIR, 'live_data.json');
if (fs.existsSync(livePath)) {
    try {
        const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
        const today = (live.lastUpdated || '').slice(0, 10);
        if (today && isTradingDay(today) && (!historyDays.length || historyDays[historyDays.length - 1].date !== today)) {
            const map = {};
            (live.topVolume || []).forEach(r => {
                if (r && r.name && r.price > 0) map[r.name.toUpperCase().trim()] = r;
            });
            historyDays.push({ date: today, map, raw: live.topVolume || [], isLive: true });
        }
    } catch (e) {}
}

// 3. Replay Day-by-Day
const lastPriceByName = {};
const timelineByDate = {};
const dailyTimeline = [];

historyDays.forEach((day, dayIdx) => {
    // Kemas kini harga diketahui dengan anomaly guard
    for (const [name, row] of Object.entries(day.map)) {
        if (lastPriceByName[name]) {
            const ratio = row.price / lastPriceByName[name];
            if (ratio < 2.0 && ratio > 0.3) {
                lastPriceByName[name] = row.price;
            }
        } else {
            lastPriceByName[name] = row.price;
        }
    }

    const tradesOnDay = [];
    let openPnl = 0;
    let closedPnl = 0;
    let openCount = 0;
    let closedCount = 0;
    let dailyPnlDelta = 0;
    let frPnlOnDay = 0;
    let htPnlOnDay = 0;

    allTrades.forEach(t => {
        if (t.entryDate > day.date) return; // Belum masuk lagi pada tarikh ini

        const nameKey = t.name.toUpperCase().trim();
        const isClosedBefore = t.status !== 'OPEN' && t.exitDate && t.exitDate < day.date;
        const isClosedToday = t.status !== 'OPEN' && t.exitDate && t.exitDate === day.date;

        if (isClosedBefore) {
            closedCount++;
            const g = (t.finalGain || 0);
            closedPnl += g;
            if (t.trackerType === 'FR') frPnlOnDay += g; else htPnlOnDay += g;
            tradesOnDay.push({
                name: t.name,
                trackerType: t.trackerType,
                statusOnDay: 'CLOSED',
                priceOnDay: +(t.exitPrice || t.currentPrice || 0).toFixed(3),
                gainOnDay: g,
                dayChangePct: 0,
                pnlDeltaToday: 0
            });
            return;
        }

        // Posisi aktif atau baru ditutup hari ini
        let curRow = day.map[nameKey];
        if (curRow && curRow.price > 0) {
            const ratio = curRow.price / t.entry;
            if (ratio > 2.5 || ratio < 0.3) curRow = null; // buang data anomaly scraper collision
        }

        let priceOnDay = curRow ? curRow.price : (lastPriceByName[nameKey] || t.entry);
        if (t.entryDate === day.date && (!curRow || curRow.price <= 0)) {
            priceOnDay = t.entry;
        }

        const gainOnDay = +(((priceOnDay - t.entry) / t.entry) * 100).toFixed(1);
        const changeRm = curRow ? (curRow.change || 0) : 0;
        const changePct = curRow ? (typeof curRow.changePct === 'number' ? curRow.changePct : (changeRm / (priceOnDay - changeRm)) * 100) : 0;
        const pnlDeltaToday = t.entry > 0 ? +((changeRm / t.entry) * 100).toFixed(1) : 0;

        if (isClosedToday) {
            closedCount++;
            const g = (t.finalGain || gainOnDay);
            closedPnl += g;
            if (t.trackerType === 'FR') frPnlOnDay += g; else htPnlOnDay += g;
            dailyPnlDelta += pnlDeltaToday;
            tradesOnDay.push({
                name: t.name,
                trackerType: t.trackerType,
                statusOnDay: 'CLOSED_TODAY',
                priceOnDay: +(t.exitPrice || priceOnDay || 0).toFixed(3),
                gainOnDay: g,
                dayChangePct: +changePct.toFixed(2),
                pnlDeltaToday
            });
        } else {
            openCount++;
            openPnl += gainOnDay;
            if (t.trackerType === 'FR') frPnlOnDay += gainOnDay; else htPnlOnDay += gainOnDay;
            dailyPnlDelta += pnlDeltaToday;
            tradesOnDay.push({
                name: t.name,
                trackerType: t.trackerType,
                statusOnDay: 'OPEN',
                priceOnDay: +priceOnDay.toFixed(3),
                gainOnDay,
                dayChangePct: +changePct.toFixed(2),
                pnlDeltaToday
            });
        }
    });

    const totalPnl = +(openPnl + closedPnl).toFixed(1);
    const totalSignals = openCount + closedCount;
    const winningTrades = tradesOnDay.filter(x => x.gainOnDay > 0);
    const winRate = totalSignals > 0 ? Math.round((winningTrades.length / totalSignals) * 100) : 0;
    const avgGain = totalSignals > 0 ? +(totalPnl / totalSignals).toFixed(1) : 0;

    let peakGainer = { gain: -999, name: '—' };
    tradesOnDay.forEach(t => {
        if (t.gainOnDay > peakGainer.gain) {
            peakGainer = { gain: t.gainOnDay, name: t.name };
        }
    });
    if (peakGainer.gain === -999) peakGainer = { gain: 0, name: '—' };

    const snapshot = {
        date: day.date,
        totalSignals,
        openCount,
        closedCount,
        openPnl: +openPnl.toFixed(1),
        closedPnl: +closedPnl.toFixed(1),
        totalPnl,
        frPnl: +frPnlOnDay.toFixed(1),
        htPnl: +htPnlOnDay.toFixed(1),
        dailyPnlDelta: +dailyPnlDelta.toFixed(1),
        winRate,
        avgGain,
        peakGainer,
        trades: tradesOnDay
    };

    dailyTimeline.push(snapshot);
});

const outputData = {
    generatedAt: new Date().toISOString(),
    totalDays: dailyTimeline.length,
    startDate: dailyTimeline[0]?.date || '',
    endDate: dailyTimeline[dailyTimeline.length - 1]?.date || '',
    timeline: dailyTimeline
};

const jsContent = `// AUTO-GENERATED oleh generate_daily_equity_tracker.js — jangan edit manual\nwindow.DAILY_EQUITY_TRACKER = ${JSON.stringify(outputData, null, 1)};\n`;
fs.writeFileSync(OUT_FILE, jsContent, 'utf8');
console.log(`✅ Daily Equity Tracker dijana: ${OUT_FILE} (${dailyTimeline.length} hari dagangan)`);
