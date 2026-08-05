/**
 * BANDINGAN TEKNIK: mana bagi PnL paling tinggi?
 * Entry = hari pertama kaunter lepas tapisan teknik (dedup per kaunter).
 * Exit variants:
 *  A) TREND RIDE: SL floor*0.97, tiada TP kaku, keluar bila close < floor, max 20 hari
 *  B) TP10/SL3 : TP +10%, SL -3%
 *  C) TP20/SL5 : TP +20%, SL -5%
 * Track juga MaxGain (potensi) dalam 20 hari.
 */
const fs = require('fs');
const path = require('path');
const histDir = path.join(__dirname, '../history');

const files = fs.readdirSync(histDir).filter(f => /^data_.*\.json$/.test(f)).sort();
const allData = {};
for (const f of files) {
    let data; try { data = JSON.parse(fs.readFileSync(path.join(histDir, f), 'utf8')); } catch (e) { continue; }
    const list = Array.isArray(data) ? data : (data.topVolume || []);
    const date = f.replace('data_', '').replace('.json', '');
    allData[date] = {};
    for (const item of list) { if (item && item.name && item.price > 0 && item.price < 500) allData[date][item.name] = item; }
}
const dates = Object.keys(allData).sort();
console.log(`Loaded ${dates.length} hari dagangan (${dates[0]} -> ${dates[dates.length - 1]})\n`);

// ---------- TEKNIK ----------
function jerungRadar(item) { // Tier 1/2/3 (sama logic scanner)
    if (!item || item.signal === 'avoid' || item.isCombStock) return null;
    const chg = item.changePct ?? item.change ?? 0;
    if (chg > 5.0) return null;
    const pb = item.pullback; if (pb == null) return null;
    const tight = typeof item.closeTightness === 'number' ? item.closeTightness : 99;
    const touches = item.touchCount || 0;
    const nearAth = pb <= 15.0;
    const secondary = pb > 15.0 && pb <= 30.0 && tight <= 5.0 && touches >= 5 && chg < 3.0 && (item.sma50 ? item.price >= item.sma50 : true);
    if (!nearAth && !secondary) return null;
    if (nearAth && item.sma50 && item.price < item.sma50) return null;
    if ((item.turnover || 0) < 300000) return null;
    if (nearAth && touches < 2) return null;
    const t1 = nearAth && !item.hasVolumeSpike && item.isConsolidation === true && touches >= 3 && tight <= 5.0;
    const t2 = nearAth && item.hasVolumeSpike && (item.volumeSpike || 0) < 3.0 && chg < 3.5 && tight <= 10.0;
    if (!t1 && !t2 && !secondary) return null;
    return t1 ? 1 : (t2 ? 2 : 3);
}

const TECHNIQUES = {
    'T1: Jerung Radar (semua tier)': it => jerungRadar(it) !== null,
    'T2: Jerung Tier-1 sahaja (ketat)': it => jerungRadar(it) === 1,
    'T3: VVIP sahaja (isVvip, non-avoid)': it => it.isVvip === true && it.signal !== 'avoid' && !it.isCombStock,
    'T4: VVIP + Near ATH (pullback<=15)': it => it.isVvip === true && it.signal !== 'avoid' && !it.isCombStock && (it.pullback ?? 99) <= 15.0,
    'T5: VVIP + signal buy + Near ATH': it => it.isVvip === true && it.signal === 'buy' && !it.isCombStock && (it.pullback ?? 99) <= 15.0,
    'T6: Confluence (VVIP + Jerung Radar)': it => it.isVvip === true && jerungRadar(it) !== null,
    'T7: Staircase + buy + near floor': it => it.setupStyle === 'STAIRCASE' && it.signal === 'buy' && it.floorLow && it.floorLow > 0 && ((it.price - it.floorLow) / it.floorLow) * 100 <= 5,
    'T8: IPO muda (<=1 thn) + VVIP': it => it.isVvip === true && it.signal !== 'avoid' && !it.isCombStock && (it.ipoYear >= 2025),
};

// ---------- BACKTEST ENGINE ----------
function futurePrices(name, fromIdx, maxDays = 20) {
    const out = [];
    let prev = allData[dates[fromIdx]][name].price;
    for (let i = fromIdx + 1; i < Math.min(dates.length, fromIdx + 1 + maxDays); i++) {
        const m = allData[dates[i]][name];
        if (m && m.price > 0) {
            const r = m.price / prev;
            if (r > 1.5 || r < 0.5) return null; // data tercemar: split/konsolidasi/ticker tukar
            out.push({ date: dates[i], price: m.price, floorLow: m.floorLow });
            prev = m.price;
        }
    }
    return out;
}

function simulate(entry, floor, fut, mode) {
    let peak = entry, maxGain = 0;
    for (const d of fut) {
        const p = d.price;
        const gain = ((p - entry) / entry) * 100;
        if (gain > maxGain) { maxGain = gain; peak = p; }
        if (mode === 'ride') {
            const f = d.floorLow || floor;
            if (p <= floor * 0.97) return { ret: ((floor * 0.97 - entry) / entry) * 100, maxGain, exit: 'SL' };
            if (p < f * 0.995) return { ret: gain, maxGain, exit: 'FLOOR_BREAK' };
        } else if (mode === 'tp10sl3') {
            if (gain <= -3) return { ret: -3, maxGain, exit: 'SL' };
            if (gain >= 10) return { ret: 10, maxGain, exit: 'TP' };
        } else if (mode === 'tp20sl5') {
            if (gain <= -5) return { ret: -5, maxGain, exit: 'SL' };
            if (gain >= 20) return { ret: 20, maxGain, exit: 'TP' };
        }
    }
    const last = fut[fut.length - 1];
    const ret = last ? ((last.price - entry) / entry) * 100 : 0;
    return { ret, maxGain, exit: 'TIME' };
}

for (const [label, fn] of Object.entries(TECHNIQUES)) {
    const seen = new Set();
    const modes = { ride: [], tp10sl3: [], tp20sl5: [], maxGain: [] };
    let n = 0;
    for (let i = 0; i < dates.length - 3; i++) {
        const dayData = allData[dates[i]];
        for (const [name, item] of Object.entries(dayData)) {
            if (seen.has(name)) continue;
            if (item.price > 50 || item.price < 0.10) continue; // buang heavyweight & sen-stock
            if (!fn(item)) continue;
            seen.add(name);
            const fut = futurePrices(name, i, 20);
            if (!fut || !fut.length) continue;
            const floor = item.floorLow || item.price * 0.95;
            modes.ride.push(simulate(item.price, floor, fut, 'ride'));
            modes.tp10sl3.push(simulate(item.price, floor, fut, 'tp10sl3'));
            modes.tp20sl5.push(simulate(item.price, floor, fut, 'tp20sl5'));
            modes.maxGain.push(fut.reduce((m, d) => Math.max(m, ((d.price - item.price) / item.price) * 100), 0));
            n++;
        }
    }
    const stats = arr => {
        if (!arr.length) return { n: 0, wr: 0, avg: 0, tot: 0 };
        const wins = arr.filter(x => x.ret > 0).length;
        const tot = arr.reduce((s, x) => s + x.ret, 0);
        return { n: arr.length, wr: (wins / arr.length * 100), avg: tot / arr.length, tot };
    };
    const mg = modes.maxGain;
    const avgMG = mg.length ? mg.reduce((a, b) => a + b, 0) / mg.length : 0;
    const hit20 = mg.length ? mg.filter(x => x >= 20).length / mg.length * 100 : 0;
    const r = stats(modes.ride), a = stats(modes.tp10sl3), b = stats(modes.tp20sl5);
    console.log(`=== ${label} ===`);
    console.log(`  Trades: ${n} | Purata MaxGain20h: ${avgMG.toFixed(1)}% | % capai +20%: ${hit20.toFixed(0)}%`);
    console.log(`  [RIDE no-TP ] WR ${r.wr.toFixed(0)}% | avg ${r.avg.toFixed(2)}% | TOTAL ${r.tot.toFixed(1)}%`);
    console.log(`  [TP10/SL3  ] WR ${a.wr.toFixed(0)}% | avg ${a.avg.toFixed(2)}% | TOTAL ${a.tot.toFixed(1)}%`);
    console.log(`  [TP20/SL5  ] WR ${b.wr.toFixed(0)}% | avg ${b.avg.toFixed(2)}% | TOTAL ${b.tot.toFixed(1)}%\n`);
}
