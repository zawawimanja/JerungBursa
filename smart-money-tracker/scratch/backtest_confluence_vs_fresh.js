/**
 * BACKTEST ADIL: Double vs Triple Confluence (logik dashboard sebenar) vs Fresh VVIP Rider.
 * Entry = hari pertama lepas tapisan, dedup per kaunter. Exit = RIDE floor (swing).
 */
const fs = require('fs');
const path = require('path');
const histDir = path.join(__dirname, '../history');

const files = fs.readdirSync(histDir).filter(f => /^data_.*\.json$/.test(f)).sort();
const allData = {};
for (const f of files) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(histDir, f), 'utf8')); } catch (e) { continue; }
    const list = Array.isArray(d) ? d : (d.topVolume || []);
    const date = f.replace('data_', '').replace('.json', '');
    allData[date] = {};
    for (const it of list) { if (it && it.name && it.price > 0 && it.price < 500) allData[date][it.name] = it; }
}
const dates = Object.keys(allData).sort();

// ---- logik dari index.html ----
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

// Fresh VVIP Rider (A5)
function freshVvipRider(item) {
    return item.isVvip === true && item.signal !== 'avoid' && !item.isCombStock
        && (item.ipoYear || 0) >= 2025 && (item.pullback ?? 99) <= 10 && (item.closeTightness ?? 99) <= 5.0
        && item.price >= 0.10 && item.price <= 50;
}

function futurePrices(name, fromIdx, maxDays = 20) {
    const out = [];
    let prev = allData[dates[fromIdx]][name].price;
    for (let i = fromIdx + 1; i < Math.min(dates.length, fromIdx + 1 + maxDays); i++) {
        const m = allData[dates[i]][name];
        if (m && m.price > 0) {
            const r = m.price / prev;
            if (r > 1.5 || r < 0.5) return null;
            out.push({ price: m.price, floorLow: m.floorLow });
            prev = m.price;
        }
    }
    return out;
}
function rideFloor(entry, floor, fut) {
    let maxGain = 0;
    for (const d of fut) {
        const g = ((d.price - entry) / entry) * 100;
        if (g > maxGain) maxGain = g;
        const f = d.floorLow || floor;
        if (d.price <= floor * 0.97) return ((floor * 0.97 - entry) / entry) * 100;
        if (d.price < f * 0.995) return g;
    }
    return ((fut[fut.length - 1].price - entry) / entry) * 100;
}

function run(label, pickFn, maxPrice) {
    const seen = new Set();
    const rets = [];
    for (let i = 0; i < dates.length - 3; i++) {
        for (const [name, item] of Object.entries(allData[dates[i]])) {
            if (seen.has(name) || item.price > maxPrice || item.price < 0.10) continue;
            if (!pickFn(item)) continue;
            seen.add(name);
            const fut = futurePrices(name, i, 20);
            if (!fut || !fut.length) continue;
            rets.push(rideFloor(item.price, item.floorLow || item.price * 0.95, fut));
        }
    }
    if (!rets.length) { console.log(`${label}: tiada trade`); return; }
    const wins = rets.filter(r => r > 0).length;
    const tot = rets.reduce((a, b) => a + b, 0);
    console.log(`${label.padEnd(42)} N=${String(rets.length).padStart(3)} | WR ${(wins / rets.length * 100).toFixed(0).padStart(3)}% | avg ${(tot / rets.length).toFixed(2).padStart(6)}% | TOTAL ${tot.toFixed(1).padStart(7)}% | worst ${Math.min(...rets).toFixed(1)}%`);
}

console.log(`Data: ${dates.length} hari (${dates[0]} -> ${dates[dates.length - 1]}), exit=RIDE floor 20h\n`);
run('Confluence 2+ (logik dashboard)', it => confluenceCount(it) >= 2, 10.0);
run('Confluence 2+ Fresh IPO sahaja', it => confluenceCount(it) >= 2 && isFreshIpo(it), 10.0);
run('TRIPLE Confluence (3+)', it => confluenceCount(it) >= 3, 10.0);
run('TRIPLE Confluence + Fresh IPO', it => confluenceCount(it) >= 3 && isFreshIpo(it), 10.0);
run('🔥 Fresh VVIP Rider (A5)', freshVvipRider, 50.0);
