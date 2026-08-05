/**
 * OPTIMIZER PnL: cari kombinasi ENTRY x EXIT paling untung.
 * - Entry: grid tapisan (ipoYear, pullback, tightness, touches, turnover, wick, vvip)
 * - Exit: pelbagai SOP (ride floor, trailing %, TP/SL combos, breakeven lock)
 * - Rank: expectancy (avg % per trade), min 15 trades supaya signifikan.
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

function futurePrices(name, fromIdx, maxDays = 20) {
    const out = [];
    let prev = allData[dates[fromIdx]][name].price;
    for (let i = fromIdx + 1; i < Math.min(dates.length, fromIdx + 1 + maxDays); i++) {
        const m = allData[dates[i]][name];
        if (m && m.price > 0) {
            const r = m.price / prev;
            if (r > 1.5 || r < 0.5) return null;
            out.push({ date: dates[i], price: m.price, floorLow: m.floorLow });
            prev = m.price;
        }
    }
    return out;
}

// ---------- ENTRY FILTERS (grid) ----------
const E = {
    vvip: it => it.isVvip === true,
    notAvoid: it => it.signal !== 'avoid',
    notComb: it => !it.isCombStock,
    fresh2025: it => (it.ipoYear || 0) >= 2025,
    pb15: it => (it.pullback ?? 99) <= 15,
    pb10: it => (it.pullback ?? 99) <= 10,
    pb7: it => (it.pullback ?? 99) <= 7,
    tight5: it => (it.closeTightness ?? 99) <= 5.0,
    tight4: it => (it.closeTightness ?? 99) <= 4.0,
    touch3: it => (it.touchCount || 0) >= 3,
    touch5: it => (it.touchCount || 0) >= 5,
    to400: it => (it.turnover || 0) >= 400000,
    to1m: it => (it.turnover || 0) >= 1000000,
    aboveSma50: it => !it.sma50 || it.price >= it.sma50,
    wick: it => it.hasLowerWickRejection === true,
    consol: it => it.isConsolidation === true,
    nearFloor3: it => it.floorLow && ((it.price - it.floorLow) / it.floorLow) * 100 <= 3,
    chg3: it => Math.abs(it.changePct ?? it.change ?? 0) <= 3,
};

// kombinasi entry untuk diuji (nama -> senarai key filter)
const ENTRY_COMBOS = {
    'BASE fresh+vvip+pb15': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15'],
    'A1 +tight5': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15', 'tight5'],
    'A2 +touch3': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15', 'touch3'],
    'A3 +tight5+touch3': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15', 'tight5', 'touch3'],
    'A4 +pb10': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb10'],
    'A5 +pb10+tight5': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb10', 'tight5'],
    'A6 +pb7': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb7'],
    'A7 +to1m': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15', 'to1m'],
    'A8 +wick': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15', 'wick'],
    'A9 +consol': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15', 'consol'],
    'A10 +nearFloor3': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15', 'nearFloor3'],
    'A11 +chg3': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb15', 'chg3'],
    'A12 KETAT penuh': ['vvip', 'notAvoid', 'notComb', 'fresh2025', 'pb10', 'tight5', 'touch3', 'to400'],
    'A13 tanpa fresh (pb10+tight5)': ['vvip', 'notAvoid', 'notComb', 'pb10', 'tight5'],
};

// ---------- EXIT SOPs ----------
function exitRideFloor(entry, floor, fut) { // SL floor*0.97, keluar bila close < floor
    let maxGain = 0;
    for (const d of fut) {
        const g = ((d.price - entry) / entry) * 100;
        if (g > maxGain) maxGain = g;
        const f = d.floorLow || floor;
        if (d.price <= floor * 0.97) return { ret: ((floor * 0.97 - entry) / entry) * 100, maxGain };
        if (d.price < f * 0.995) return { ret: g, maxGain };
    }
    const l = fut[fut.length - 1];
    return { ret: ((l.price - entry) / entry) * 100, maxGain };
}
function exitTrail(pct) {
    return (entry, floor, fut) => {
        let peak = entry, maxGain = 0;
        for (const d of fut) {
            const g = ((d.price - entry) / entry) * 100;
            if (g > maxGain) maxGain = g;
            if (d.price > peak) peak = d.price;
            const hardSL = floor * 0.97;
            if (d.price <= hardSL) return { ret: ((hardSL - entry) / entry) * 100, maxGain };
            if (peak > entry * 1.05 && d.price <= peak * (1 - pct / 100)) return { ret: ((peak * (1 - pct / 100) - entry) / entry) * 100, maxGain };
        }
        const l = fut[fut.length - 1];
        return { ret: ((l.price - entry) / entry) * 100, maxGain };
    };
}
function exitTpSl(tp, sl) {
    return (entry, floor, fut) => {
        let maxGain = 0;
        for (const d of fut) {
            const g = ((d.price - entry) / entry) * 100;
            if (g > maxGain) maxGain = g;
            if (g <= sl) return { ret: sl, maxGain };
            if (g >= tp) return { ret: tp, maxGain };
        }
        const l = fut[fut.length - 1];
        return { ret: ((l.price - entry) / entry) * 100, maxGain };
    };
}
function exitBElock(entry, floor, fut) { // bila +8%, naikkan SL ke breakeven; SL asal floor*0.97; ride floor selepas tu
    let maxGain = 0, sl = floor * 0.97, beArmed = false;
    for (const d of fut) {
        const g = ((d.price - entry) / entry) * 100;
        if (g > maxGain) maxGain = g;
        if (g >= 8) { beArmed = true; sl = Math.max(sl, entry * 1.001); }
        const f = d.floorLow || floor;
        if (beArmed && d.price < f * 0.995) return { ret: g, maxGain };
        if (d.price <= sl) return { ret: ((sl - entry) / entry) * 100, maxGain };
    }
    const l = fut[fut.length - 1];
    return { ret: ((l.price - entry) / entry) * 100, maxGain };
}

const EXITS = {
    'RIDE floor': exitRideFloor,
    'RIDE+BE@8%': exitBElock,
    'Trail 8%': exitTrail(8),
    'Trail 12%': exitTrail(12),
    'TP15/SL3': exitTpSl(15, -3),
    'TP25/SL5': exitTpSl(25, -5),
    'TP30/SL4': exitTpSl(30, -4),
};

// ---------- RUN ----------
const results = [];
for (const [ename, keys] of Object.entries(ENTRY_COMBOS)) {
    const seen = new Set();
    const entries = [];
    for (let i = 0; i < dates.length - 3; i++) {
        for (const [name, item] of Object.entries(allData[dates[i]])) {
            if (seen.has(name)) continue;
            if (item.price > 50 || item.price < 0.10) continue;
            if (!keys.every(k => E[k](item))) continue;
            seen.add(name);
            const fut = futurePrices(name, i, 20);
            if (!fut || !fut.length) continue;
            entries.push({ item, fut });
        }
    }
    if (entries.length < 10) { results.push({ ename, n: entries.length, skip: true }); continue; }
    for (const [xname, xfn] of Object.entries(EXITS)) {
        const rets = entries.map(({ item, fut }) => xfn(item.price, item.floorLow || item.price * 0.95, fut).ret);
        const wins = rets.filter(r => r > 0).length;
        const tot = rets.reduce((a, b) => a + b, 0);
        results.push({ ename, xname, n: rets.length, wr: wins / rets.length * 100, avg: tot / rets.length, tot });
    }
}

console.log(`Data: ${dates.length} hari (${dates[0]} -> ${dates[dates.length - 1]})\n`);
const valid = results.filter(r => !r.skip && r.n >= 15).sort((a, b) => b.avg - a.avg);
console.log('TOP 20 KOMBINASI (min 15 trades), rank ikut EXPECTACY avg/trade:\n');
console.log('ENTRY'.padEnd(34) + 'EXIT'.padEnd(14) + 'N'.padStart(4) + 'WR%'.padStart(6) + 'AVG%'.padStart(8) + 'TOTAL%'.padStart(9));
valid.slice(0, 20).forEach(r => {
    console.log(r.ename.padEnd(34) + r.xname.padEnd(14) + String(r.n).padStart(4) + r.wr.toFixed(0).padStart(6) + r.avg.toFixed(2).padStart(8) + r.tot.toFixed(1).padStart(9));
});
console.log('\nSample kecil (<15 trade, dirujuk sahaja):');
results.filter(r => !r.skip && r.n < 15).forEach(r => console.log(`  ${r.ename} [${r.xname}] n=${r.n} avg=${r.avg.toFixed(2)}%`));
