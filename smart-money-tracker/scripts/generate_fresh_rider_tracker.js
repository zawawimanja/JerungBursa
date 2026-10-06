// =============================================================
// FRESH RIDER & ADD-ON A+ TRACKER GENERATOR
// Replay semua data history + live, kesan setiap kaunter yang qualify
// Fresh VVIP Rider (Day 1) dan ⭐ ADD-ON A+ (Base 2 Staircase),
// track sampai EXIT (Hybrid Trailing Stop) atau kekal OPEN.
// Output: window.FRESH_RIDER_TRACKER & window.ADD_ON_TRACKER dalam fresh_rider_tracker.js
// =============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HIST_DIR = path.join(path.join(__dirname, '..'), 'history');
const OUT_FILE = path.join(path.join(__dirname, '..'), 'fresh_rider_tracker.js');

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

function parseDateFlexible(dStr, defaultYear) {
    if (!dStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return new Date(dStr + 'T00:00:00Z');
    const parts = dStr.trim().split(/\s+/);
    if (parts.length >= 2) {
        const day = parseInt(parts[0], 10);
        const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
        const m = months[parts[1].slice(0,3).toLowerCase()];
        const yr = parts[2] ? parseInt(parts[2], 10) : (defaultYear || 2026);
        if (!isNaN(day) && m !== undefined) return new Date(Date.UTC(yr, m, day));
    }
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
}

function getIpoDaysAge(item, dateStr) {
    if (!item) return null;
    if (typeof item.ipoAge === 'number') return item.ipoAge;
    if (item.listingDate && dateStr) {
        const listD = parseDateFlexible(item.listingDate);
        const curD = parseDateFlexible(dateStr);
        if (listD && curD) {
            return Math.round((curD.getTime() - listD.getTime()) / (24 * 3600 * 1000));
        }
    }
    return null;
}

function isBlackSwanClean(name, item, dateStr) {
    if (!dateStr) return true;
    const refDate = parseDateFlexible(dateStr) || new Date();
    const up = (name || '').toUpperCase();
    const news = newsData[up];

    // Explicit Blacklist: Rule 4 Penny Lemau & Rule 9 Black Swan Case Studies
    if (up === 'AMS') return false; // Rule 4: Penny Lemau (WR 7.1%)
    if (up === 'SRKK' || up === 'SRKKAI') {
        const age = getIpoDaysAge(item, dateStr);
        if (age == null || age < 15) return false; // Rule 9.3: IPO Day 2 Debut Dump
    }
    if (up === 'OXB') {
        // Rule 9.2: QR Trap pada 21 Ogos & panik jualan pasca-QR
        if (dateStr >= '2026-08-18' && dateStr <= '2026-09-15') return false;
    }

    // 1. Semakan Ex-Dividend Trap (-2 hingga +10 hari)
    if (news && Array.isArray(news.entitlements)) {
        for (const ent of news.entitlements) {
            if (!ent.isDividend || !ent.exDate) continue;
            const exD = parseDateFlexible(ent.exDate, refDate.getUTCFullYear());
            if (!exD) continue;
            const diffDays = Math.round((exD.getTime() - refDate.getTime()) / (24 * 3600 * 1000));
            if (diffDays >= -2 && diffDays <= 10) return false;
        }
    }

    // 2. Semakan QR / Financial Results (-7 hingga +10 hari per Rule 9 SOP)
    if (news && Array.isArray(news.announcements)) {
        for (const ann of news.announcements) {
            const cat = (ann.category || '').toUpperCase();
            const title = (ann.title || '').toUpperCase();
            if (title.includes('QUARTERLY') || title.includes('FINANCIAL RESULTS') || cat.includes('FINANCIAL')) {
                const annD = parseDateFlexible(ann.date, refDate.getUTCFullYear());
                if (annD) {
                    const diffDays = Math.round((annD.getTime() - refDate.getTime()) / (24 * 3600 * 1000));
                    if (diffDays >= -7 && diffDays <= 10) return false;
                }
            }
        }
    }

    // 3. Post-IPO Debut Dump (< 15 hari & touchCount < 3 per Rule 9 SOP)
    const age = getIpoDaysAge(item, dateStr);
    if (age != null && age < 15 && (item.touchCount || 0) < 3) return false;

    return true;
}

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

// ---- Rule Fresh VVIP Rider (Day 1) ----
function isFreshRiderPick(item, dateStr) {
    if (!item || item.price < 0.10 || item.price > 50) return false;
    if (item.isVvip !== true || item.signal === 'avoid' || item.isCombStock) return false;
    if ((item.ipoYear || 0) < 2025) return false;
    if (dateStr && !isBlackSwanClean(item.name, item, dateStr)) return false;
    const pb = item.pullback ?? 99;
    if (pb > 10.0) return false;

    // Minimum Turnover jerung (RM 1.5M min)
    const toVal = item.turnover || item.rawTurnover || 0;
    if (toVal < 1500000) return false;

    // Anti-Debut Dump Shield (Rule 9 SOP: wait min 15 days or at least 3 floor touches)
    const age = getIpoDaysAge(item, dateStr);
    if (age != null && age < 15 && (item.touchCount || 0) < 3) return false;

    const isGreenBreakout = (item.change >= 0 || (item.changePct || 0) >= 0);
    const tight = typeof item.closeTightness === 'number' ? item.closeTightness : 99;

    if (item.hasVolumeSpike === true) {
        if (!isGreenBreakout) return false; // CS Merah spike / dump rejected
        if (tight > 10.0) return false; // Breakout candle max tightness 10%
    } else {
        if (tight > 5.0) return false;
    }

    // SL Risk (Floor Distance) must be <= 10.0% (Align with Scanner)
    const f = item.effFloor || item.floorLow || 0;
    const fDistVal = f > 0 ? ((item.price - f) / f * 100) : 99;
    if (fDistVal > 10.0 || fDistVal < -2.0) return false;

    return true;
}

// ---- Rule ⭐ ADD-ON A+ (Base 1 / Base 2 Staircase) ----
function isAddOnAPick(item, initialBasePrice, effFloor, dateStr) {
    if (!item || !item.name || item.price <= 0 || item.price > 50) return false;
    if (item.isVvip !== true || item.signal === 'avoid' || item.isCombStock) return false;
    if ((item.ipoYear || 0) < 2025) return false;
    if (dateStr && !isBlackSwanClean(item.name, item, dateStr)) return false;
    const pb = item.pullback ?? 99;
    if (pb > 10.0) return false;
    
    const tight = typeof item.closeTightness === 'number' ? item.closeTightness : 99;
    if (tight > 3.5) return false;

    const turnover = item.turnover || item.rawTurnover || 0;
    if (turnover < 2000000) return false;

    const f = effFloor || item.floorLow || 0;
    const floorDist = f > 0 ? ((item.price - f) / f * 100) : 99;

    const touches = item.touchCount || 0;
    const isSolidBase2 = (touches >= 3 && tight <= 3.5 && floorDist <= 4.5 && turnover >= 2000000);

    if (floorDist > 3.5 && !isSolidBase2) return false;
    if (item.hasVolumeSpike === true) return false;

    if (initialBasePrice > 0) {
        const gainFromBase = ((item.price - initialBasePrice) / initialBasePrice * 100);
        if (gainFromBase > 20.0 && !isSolidBase2) return false;
    }
    return true;
}
const { BURSA_MALAYSIA_HOLIDAYS, isTradingDay } = require('./lib/bursa_calendar');

const files = fs.readdirSync(HIST_DIR).filter(f => /^data_.*\.json$/.test(f))
    .filter(f => fs.statSync(path.join(HIST_DIR, f)).size > 100000)
    .filter(f => isTradingDay(f.replace('data_', '').replace('.json', '')))
    .sort();

const dayList = [];
for (const f of files) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(HIST_DIR, f), 'utf8')); } catch (e) { continue; }
    dayList.push({ date: f.replace('data_', '').replace('.json', ''), rows: d.topVolume || [] });
}

const liveFile = path.join(path.join(__dirname, '..'), 'live_data.json');
if (fs.existsSync(liveFile)) {
    try {
        const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
        const today = (live.lastUpdated || '').slice(0, 10);
        if (today && isTradingDay(today) && (!dayList.length || dayList[dayList.length - 1].date !== today)) {
            dayList.push({ date: today, rows: live.topVolume || [], isLive: true });
        }
    } catch (e) { /* abaikan */ }
}

const recentByName = {};
function dynamicFloor(name, price, floorLow) {
    const rfArr = recentByName[name] || [];
    const rf = rfArr.length ? Math.min(...rfArr) : 0;
    const f = floorLow || 0;
    if (f > 0 && rf > 0 && ((price - f) / f) > 0.10) return Math.max(f, rf);
    return f || rf;
}

// -------------------------------------------------------------
// 1. ENGINE 1: FRESH RIDER NEW (DAY 1) TRACKER
// -------------------------------------------------------------
const openFR = {};
const tradesFR = [];

for (const day of dayList) {
    const map = {};
    for (const it of day.rows) if (it && it.name && it.price > 0) map[canonName(it.name).toUpperCase()] = it;

    for (const [name, t] of Object.entries(openFR)) {
        const cur = map[name];
        if (!cur || cur.price <= 0) continue;
        t.days++;
        t.lastDate = day.date;
        t.currentPrice = +cur.price.toFixed(3);
        if (cur.floorLow) t.currentFloor = +dynamicFloor(name, cur.price, cur.floorLow).toFixed(3);
        if (cur.price > t.high) { t.high = +cur.price.toFixed(3); t.highDate = day.date; }
        t.maxGain = +(((t.high - t.entry) / t.entry) * 100).toFixed(1);

        // Rule 6: Kunci Bebas Risiko & Scale-Out
        let slTrail = t.entryFloor > 0 ? t.entryFloor * 0.97 : t.entry * 0.89; // Initial SL bawah lantai
        if (t.maxGain >= 10) {
            slTrail = Math.max(t.entry * 1.10, t.high * 0.85); // Lock di TP1 (+10%), trail 15% dari puncak
        } else if (t.maxGain >= 5) {
            slTrail = Math.max(t.entry, t.high * 0.88); // Free Trade: Breakeven
        } else {
            slTrail = Math.max(slTrail, t.high * 0.88); // Default trail 12%
        }
        
        t.slTrail = +slTrail.toFixed(3);
        if (cur.price <= slTrail) {
            t.status = 'CLOSED_SL';
            t.exitDate = day.date;
            t.exitPrice = +cur.price.toFixed(3);
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
            delete openFR[name];
        } else if (t.days >= 60 && t.maxGain < 10 && t.finalGain < 5) { // Time Stop: Lemau lepas 60 hari
            t.status = 'CLOSED_TIME';
            t.exitDate = day.date;
            t.exitPrice = +cur.price.toFixed(3);
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
            delete openFR[name];
        } else {
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
        }
    }

    for (const it of day.rows) {
        if (!it || !it.name || it.price <= 0) continue;
        const name = canonName(it.name).toUpperCase();
        if (openFR[name] || tradesFR.some(t => t.name.toUpperCase() === name)) continue;
        it.effFloor = dynamicFloor(name, it.price, it.floorLow);
        if (!isFreshRiderPick(it, day.date)) continue;
        const t = {
            name: canonName(it.name),
            entryType: '🔥 NEW',
            entryDate: day.date,
            entry: +it.price.toFixed(3),
            entryFloor: +dynamicFloor(name, it.price, it.floorLow || it.price * 0.95).toFixed(3),
            currentFloor: +dynamicFloor(name, it.price, it.floorLow || it.price * 0.95).toFixed(3),
            currentPrice: +it.price.toFixed(3),
            high: +it.price.toFixed(3),
            highDate: day.date,
            maxGain: 0,
            finalGain: 0,
            day1ChangePct: +(typeof it.changePct === 'number' ? it.changePct : ((it.change && it.price) ? (it.change / (it.price - it.change)) * 100 : 0)).toFixed(2),
            days: 1,
            lastDate: day.date,
            status: 'OPEN',
            ipoYear: it.ipoYear || null,
            sector: it.sector || '',
        };
        openFR[name] = t;
        tradesFR.push(t);
    }

    for (const [nm, it] of Object.entries(map)) {
        if (!recentByName[nm]) recentByName[nm] = [];
        recentByName[nm].push(it.price);
        if (recentByName[nm].length > 5) recentByName[nm].shift();
    }
}

// -------------------------------------------------------------
// 2. ENGINE 2: ⭐ ADD-ON A+ TRACKER (TRACK SETIAP KALI TRIGGER)
// -------------------------------------------------------------
let openAddOn = [];
const tradesAddOn = [];
const initialBaseMap = {};
const recentByNameAddOn = {};

function dynamicFloorAddOn(name, price, floorLow) {
    const rfArr = recentByNameAddOn[name] || [];
    const rf = rfArr.length ? Math.min(...rfArr) : 0;
    const f = floorLow || 0;
    if (f > 0 && rf > 0 && ((price - f) / f) > 0.10) return Math.max(f, rf);
    return f || rf;
}

for (const day of dayList) {
    const map = {};
    for (const it of day.rows) if (it && it.name && it.price > 0) map[canonName(it.name).toUpperCase()] = it;

    // Track initial base (Day 1) for every stock
    for (const it of day.rows) {
        if (!it || !it.name || it.price <= 0) continue;
        const name = canonName(it.name).toUpperCase();
        it.effFloor = dynamicFloor(name, it.price, it.floorLow);
        if (!initialBaseMap[name] && isFreshRiderPick(it, day.date)) {
            initialBaseMap[name] = { date: day.date, price: it.price };
        }
    }

    // Update existing open ADD-ON positions
    const nextOpen = [];
    for (const t of openAddOn) {
        const name = t.name.toUpperCase();
        const cur = map[name];
        if (!cur || cur.price <= 0) {
            nextOpen.push(t);
            continue;
        }
        t.days++;
        t.lastDate = day.date;
        t.currentPrice = +cur.price.toFixed(3);
        if (cur.floorLow) t.currentFloor = +dynamicFloorAddOn(name, cur.price, cur.floorLow).toFixed(3);
        if (cur.price > t.high) { t.high = +cur.price.toFixed(3); t.highDate = day.date; }
        t.maxGain = +(((t.high - t.entry) / t.entry) * 100).toFixed(1);

        // Rule 6: Kunci Bebas Risiko & Scale-Out
        let slTrail = t.entryFloor > 0 ? t.entryFloor * 0.97 : t.entry * 0.89;
        if (t.maxGain >= 10) {
            slTrail = Math.max(t.entry * 1.10, t.high * 0.85); // Lock di TP1 (+10%), trail 15% dari puncak
        } else if (t.maxGain >= 5) {
            slTrail = Math.max(t.entry, t.high * 0.88); // Free Trade: Breakeven
        } else {
            slTrail = Math.max(slTrail, t.high * 0.88); // Default trail 12%
        }
        
        t.slTrail = +slTrail.toFixed(3);
        if (cur.price <= slTrail) {
            t.status = 'CLOSED_SL';
            t.exitDate = day.date;
            t.exitPrice = +cur.price.toFixed(3);
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
        } else if (t.days >= 60 && t.maxGain < 10 && t.finalGain < 5) {
            t.status = 'CLOSED_TIME';
            t.exitDate = day.date;
            t.exitPrice = +cur.price.toFixed(3);
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
        } else {
            t.finalGain = +(((cur.price - t.entry) / t.entry) * 100).toFixed(1);
            nextOpen.push(t);
        }
    }
    openAddOn = nextOpen;

    // Scan for new ADD-ON A+ entries on this date (setiap kali trigger, rekod trade baharu)
    for (const it of day.rows) {
        if (!it || !it.name || it.price <= 0) continue;
        const name = canonName(it.name).toUpperCase();
        const base = initialBaseMap[name];
        if (!base || day.date <= base.date) continue; // Wajib selepas Day 1

        const effFloor = dynamicFloorAddOn(name, it.price, it.floorLow);
        // Wajib qualify sebagai setup yang sah
        if (!isAddOnAPick(it, base.price, effFloor, day.date)) continue;

        const gainFromBase = ((it.price - base.price) / base.price) * 100;
        const touches = it.touchCount || 0;
        const tight = typeof it.closeTightness === 'number' ? it.closeTightness : 99;
        const fDist = effFloor > 0 ? ((it.price - effFloor) / effFloor * 100) : 99;
        const toVal = it.turnover || it.rawTurnover || 0;
        // isFreshBase1 = ADD-ON A+ (Awal): kenaikan ≤ 20% dari base, lantai rapat ≤ 3.5%, jerung ≥ 2M
        const isFreshBase1 = (gainFromBase >= 0 && gainFromBase <= 20 && fDist <= 3.5 && toVal >= 2000000);
        // isSolidBase2 = LANTAI RAPAT: tangga solid (sentuhan ≥ 3x, tight ≤ 3.5%, lantai ≤ 4.5%, jerung ≥ 2M)
        const isSolidBase2 = (touches >= 3 && tight <= 3.5 && fDist <= 4.5 && toVal >= 2000000);
        // LANTAI RAPAT = lulus isSolidBase2 TAPI GAGAL isFreshBase1 (lantai jarak 3.5%-4.5%)
        // Selaras 100% dengan logik scanner (index.html / buy_alert.js)
        const isFloorAddon = (isSolidBase2 && !isFreshBase1);
        const entryType = isFloorAddon ? '🛡️ ADD-ON (LANTAI RAPAT)' : '⭐ ADD-ON A+';

        const t = {
            id: `${name}_${day.date}_ADDON`,
            name: canonName(it.name),
            entryType: entryType,
            entryDate: day.date,
            entry: +it.price.toFixed(3),
            entryFloor: +effFloor.toFixed(3),
            currentFloor: +effFloor.toFixed(3),
            currentPrice: +it.price.toFixed(3),
            high: +it.price.toFixed(3),
            highDate: day.date,
            maxGain: 0,
            finalGain: 0,
            day1ChangePct: +(typeof it.changePct === 'number' ? it.changePct : ((it.change && it.price) ? (it.change / (it.price - it.change)) * 100 : 0)).toFixed(2),
            days: 1,
            lastDate: day.date,
            status: 'OPEN',
            ipoYear: it.ipoYear || null,
            sector: it.sector || '',
        };
        openAddOn.push(t);
        tradesAddOn.push(t);
    }

    for (const [nm, it] of Object.entries(map)) {
        if (!recentByNameAddOn[nm]) recentByNameAddOn[nm] = [];
        recentByNameAddOn[nm].push(it.price);
        if (recentByNameAddOn[nm].length > 5) recentByNameAddOn[nm].shift();
    }
}

// ---- Backfill harga terkini untuk posisi beku dari Yahoo ----
const { backfillStaleTrades } = require('./backfill_stale.js');
const latestDay = dayList.length ? dayList[dayList.length - 1].date : '';

backfillStaleTrades(tradesFR, latestDay, (t) => Math.max(t.entry * 0.89, t.high * 0.80));
backfillStaleTrades(tradesAddOn, latestDay, (t) => Math.max(t.entry * 0.89, t.high * 0.80));

const openFRTrades = tradesFR.filter(t => t.status === 'OPEN').sort((a, b) => b.entryDate.localeCompare(a.entryDate));
const closedFRTrades = tradesFR.filter(t => t.status !== 'OPEN').sort((a, b) => b.exitDate.localeCompare(a.exitDate));
const allFR = [...openFRTrades, ...closedFRTrades];

const winsFR = closedFRTrades.filter(t => t.finalGain > 0).length;
const openPnlFR = openFRTrades.reduce((a, b) => a + (b.finalGain || 0), 0);
const closedPnlFR = closedFRTrades.reduce((a, b) => a + (b.finalGain || 0), 0);
const summaryFR = {
    generatedAt: new Date().toISOString(),
    dataDays: dayList.length,
    totalTracked: tradesFR.length,
    openCount: openFRTrades.length,
    closedCount: closedFRTrades.length,
    closedWins: winsFR,
    closedWinRate: closedFRTrades.length ? Math.round(100 * winsFR / closedFRTrades.length) : 0,
    closedAvgGain: closedFRTrades.length ? +(closedFRTrades.reduce((a, b) => a + b.finalGain, 0) / closedFRTrades.length).toFixed(1) : 0,
    openPnl: +openPnlFR.toFixed(1),
    closedPnl: +closedPnlFR.toFixed(1),
    totalPnlNow: +(openPnlFR + closedPnlFR).toFixed(1),
};

function buildSummary(tradesList) {
    const openTrades = tradesList.filter(t => t.status === 'OPEN').sort((a, b) => b.entryDate.localeCompare(a.entryDate));
    const closedTrades = tradesList.filter(t => t.status !== 'OPEN').sort((a, b) => b.exitDate.localeCompare(a.exitDate));
    const allTrades = [...openTrades, ...closedTrades];
    const wins = closedTrades.filter(t => t.finalGain > 0).length;
    const openPnl = openTrades.reduce((a, b) => a + (b.finalGain || 0), 0);
    const closedPnl = closedTrades.reduce((a, b) => a + (b.finalGain || 0), 0);
    const summary = {
        generatedAt: new Date().toISOString(),
        dataDays: dayList.length,
        totalTracked: tradesList.length,
        openCount: openTrades.length,
        closedCount: closedTrades.length,
        closedWins: wins,
        closedWinRate: closedTrades.length ? Math.round(100 * wins / closedTrades.length) : 0,
        closedAvgGain: closedTrades.length ? +(closedTrades.reduce((a, b) => a + b.finalGain, 0) / closedTrades.length).toFixed(1) : 0,
        openPnl: +openPnl.toFixed(1),
        closedPnl: +closedPnl.toFixed(1),
        totalPnlNow: +(openPnl + closedPnl).toFixed(1),
    };
    return { summary, allTrades };
}

const tradesAddOnEarly = tradesAddOn.filter(t => t.entryType === '⭐ ADD-ON A+');
const tradesAddOnFloor = tradesAddOn.filter(t => t.entryType === '🛡️ ADD-ON (LANTAI RAPAT)');

const earlyRes = buildSummary(tradesAddOnEarly);
const summaryAddOnEarly = earlyRes.summary;
const allAddOnEarly = earlyRes.allTrades;

const floorRes = buildSummary(tradesAddOnFloor);
const summaryAddOnFloor = floorRes.summary;
const allAddOnFloor = floorRes.allTrades;

const addOnRes = buildSummary(tradesAddOn);
const summaryAddOn = addOnRes.summary;
const allAddOn = addOnRes.allTrades;

// ---- 3. UNIFIED ALL-IN-ONE TRACKER (COMBINED NEW + ADD-ON) ----
const allUnifiedRaw = [...tradesFR, ...tradesAddOn];
const openUnifiedTrades = allUnifiedRaw.filter(t => t.status === 'OPEN').sort((a, b) => b.entryDate.localeCompare(a.entryDate));
const closedUnifiedTrades = allUnifiedRaw.filter(t => t.status !== 'OPEN').sort((a, b) => b.exitDate.localeCompare(a.exitDate));
const allUnified = [...openUnifiedTrades, ...closedUnifiedTrades];

const winsUnified = closedUnifiedTrades.filter(t => t.finalGain > 0).length;
const openPnlUnified = openUnifiedTrades.reduce((a, b) => a + (b.finalGain || 0), 0);
const closedPnlUnified = closedUnifiedTrades.reduce((a, b) => a + (b.finalGain || 0), 0);
const summaryUnified = {
    generatedAt: new Date().toISOString(),
    dataDays: dayList.length,
    totalTracked: allUnified.length,
    openCount: openUnifiedTrades.length,
    closedCount: closedUnifiedTrades.length,
    closedWins: winsUnified,
    closedWinRate: closedUnifiedTrades.length ? Math.round(100 * winsUnified / closedUnifiedTrades.length) : 0,
    closedAvgGain: closedUnifiedTrades.length ? +(closedUnifiedTrades.reduce((a, b) => a + b.finalGain, 0) / closedUnifiedTrades.length).toFixed(1) : 0,
    openPnl: +openPnlUnified.toFixed(1),
    closedPnl: +closedPnlUnified.toFixed(1),
    totalPnlNow: +(openPnlUnified + closedPnlUnified).toFixed(1),
};

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

// ---- Backtest 1: FR NEW (Day 1) ----
const btSeen = new Set();
const btRets = [];
for (let i = 0; i < dateMap.length - 3; i++) {
    for (const [name, item] of Object.entries(dateMap[i].map)) {
        if (btSeen.has(name) || item.price < 0.10) continue;
        if (!isFreshRiderPick(item)) continue;
        btSeen.add(name);
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

// ---- Backtest 2: ADD-ON A+ & Lantai Rapat ----
// Rebuild initial base map independently for clean backtest simulation
const btBaseMap = {};
const btAddOnRets = [];
const btFloorRets = [];

for (let i = 0; i < dateMap.length - 3; i++) {
    const dayEntry = dateMap[i];

    // Pass 1: track initial base price for stocks that first qualify as FR NEW
    for (const [name, item] of Object.entries(dayEntry.map)) {
        if (!btBaseMap[name] && item.price >= 0.10 && isFreshRiderPick(item, dayEntry.date)) {
            btBaseMap[name] = { date: dayEntry.date, price: item.price };
        }
    }

    // Pass 2: scan for ADD-ON A+ / Lantai Rapat signals on this day
    for (const [name, item] of Object.entries(dayEntry.map)) {
        const base = btBaseMap[name];
        if (!base || dayEntry.date <= base.date) continue;
        if (item.price < 0.10 || item.price > 50) continue;

        const effFloor = item.floorLow || item.price * 0.95;
        if (!isAddOnAPick(item, base.price, effFloor, dayEntry.date)) continue;

        const gainFromBase = ((item.price - base.price) / base.price) * 100;
        const touches = item.touchCount || 0;
        const tight = typeof item.closeTightness === 'number' ? item.closeTightness : 99;
        const fDist = effFloor > 0 ? ((item.price - effFloor) / effFloor * 100) : 99;
        const toVal = item.turnover || item.rawTurnover || 0;

        const isFreshBase1 = (gainFromBase >= 0 && gainFromBase <= 20 && fDist <= 3.5 && toVal >= 2000000);
        const isSolidBase2 = (touches >= 3 && tight <= 3.5 && fDist <= 4.5 && toVal >= 2000000);
        const isFloorAddon = (isSolidBase2 && !isFreshBase1);

        // Simulate forward: hold up to 20 days with trailing stop
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

        const ret = rideFloor20(item.price, effFloor, fut);
        if (isFreshBase1) btAddOnRets.push(ret);
        else if (isFloorAddon) btFloorRets.push(ret);
    }
}

const btAddOnWins = btAddOnRets.filter(r => r > 0).length;
const backtestAddOn = btAddOnRets.length > 0 ? {
    dataStart: dayList[0].date,
    dataEnd: dayList[dayList.length - 1].date,
    dataDays: dayList.length,
    signals: btAddOnRets.length,
    winRate: Math.round(100 * btAddOnWins / btAddOnRets.length),
    avgGain: +(btAddOnRets.reduce((a, b) => a + b, 0) / btAddOnRets.length).toFixed(1),
    totalPnl: +btAddOnRets.reduce((a, b) => a + b, 0).toFixed(1),
    worstLoss: +Math.min(...btAddOnRets).toFixed(1),
    grossWin: +(btAddOnRets.filter(r => r > 0).reduce((a, b) => a + b, 0)).toFixed(1),
    grossLoss: +(Math.abs(btAddOnRets.filter(r => r <= 0).reduce((a, b) => a + b, 0))).toFixed(1),
    profitFactor: (() => {
        const gw = btAddOnRets.filter(r => r > 0).reduce((a, b) => a + b, 0);
        const gl = Math.abs(btAddOnRets.filter(r => r <= 0).reduce((a, b) => a + b, 0));
        return gl > 0 ? +(gw / gl).toFixed(2) : 99;
    })(),
} : {};

const btFloorWins = btFloorRets.filter(r => r > 0).length;
const backtestFloor = btFloorRets.length > 0 ? {
    dataStart: dayList[0].date,
    dataEnd: dayList[dayList.length - 1].date,
    dataDays: dayList.length,
    signals: btFloorRets.length,
    winRate: Math.round(100 * btFloorWins / btFloorRets.length),
    avgGain: +(btFloorRets.reduce((a, b) => a + b, 0) / btFloorRets.length).toFixed(1),
    totalPnl: +btFloorRets.reduce((a, b) => a + b, 0).toFixed(1),
    worstLoss: +Math.min(...btFloorRets).toFixed(1),
    grossWin: +(btFloorRets.filter(r => r > 0).reduce((a, b) => a + b, 0)).toFixed(1),
    grossLoss: +(Math.abs(btFloorRets.filter(r => r <= 0).reduce((a, b) => a + b, 0))).toFixed(1),
    profitFactor: (() => {
        const gw = btFloorRets.filter(r => r > 0).reduce((a, b) => a + b, 0);
        const gl = Math.abs(btFloorRets.filter(r => r <= 0).reduce((a, b) => a + b, 0));
        return gl > 0 ? +(gw / gl).toFixed(2) : 99;
    })(),
} : {};

const js = `// AUTO-GENERATED oleh generate_fresh_rider_tracker.js — jangan edit manual\n`
    + `window.FRESH_RIDER_TRACKER = ${JSON.stringify({ summary: summaryFR, backtest, trades: allFR }, null, 1)};\n`
    + `window.ADD_ON_TRACKER = ${JSON.stringify({ summary: summaryAddOnEarly, backtest: backtestAddOn, trades: allAddOnEarly }, null, 1)};\n`
    + `window.FLOOR_ADDON_TRACKER = ${JSON.stringify({ summary: summaryAddOnFloor, backtest: backtestFloor, trades: allAddOnFloor }, null, 1)};\n`
    + `window.ALL_TRACKER = ${JSON.stringify({ summary: summaryUnified, trades: allUnified }, null, 1)};\n`;

fs.writeFileSync(OUT_FILE, js);

console.log(`✅ Tracker dijana: ${OUT_FILE}`);
console.log(`   🌟 UNIFIED ALL: Total ${summaryUnified.totalTracked} | OPEN ${summaryUnified.openCount} | CLOSED ${summaryUnified.closedCount} (WR ${summaryUnified.closedWinRate}%, avg ${summaryUnified.closedAvgGain}%)`);
console.log(`   🔥 FRESH RIDER (Day 1): Total ${summaryFR.totalTracked} | OPEN ${summaryFR.openCount} | CLOSED ${summaryFR.closedCount} (WR ${summaryFR.closedWinRate}%, avg ${summaryFR.closedAvgGain}%)`);
console.log(`      ↳ Backtest (sim): ${backtest.signals} signals | WR ${backtest.winRate}% | Avg ${backtest.avgGain >= 0 ? '+' : ''}${backtest.avgGain}% | Total +${backtest.totalPnl}%`);
console.log(`   ⭐ ADD-ON A+ (Awal <= 20%): Total ${summaryAddOnEarly.totalTracked} | OPEN ${summaryAddOnEarly.openCount} | CLOSED ${summaryAddOnEarly.closedCount} (WR ${summaryAddOnEarly.closedWinRate}%, avg ${summaryAddOnEarly.closedAvgGain}%)`);
console.log(`      ↳ Backtest (sim): ${backtestAddOn.signals ?? 0} signals | WR ${backtestAddOn.winRate ?? 0}% | Avg ${backtestAddOn.avgGain >= 0 ? '+' : ''}${backtestAddOn.avgGain ?? 0}% | PF ${backtestAddOn.profitFactor ?? 0}x | Total +${backtestAddOn.totalPnl ?? 0}%`);
console.log(`   🛡️ ADD-ON (Lantai Rapat): Total ${summaryAddOnFloor.totalTracked} | OPEN ${summaryAddOnFloor.openCount} | CLOSED ${summaryAddOnFloor.closedCount} (WR ${summaryAddOnFloor.closedWinRate}%, avg ${summaryAddOnFloor.closedAvgGain}%)`);
console.log(`      ↳ Backtest (sim): ${backtestFloor.signals ?? 0} signals | WR ${backtestFloor.winRate ?? 0}% | Avg ${backtestFloor.avgGain >= 0 ? '+' : ''}${backtestFloor.avgGain ?? 0}% | PF ${backtestFloor.profitFactor ?? 0}x | Total +${backtestFloor.totalPnl ?? 0}%`);
