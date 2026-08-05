/**
 * BACKTEST BERSIH: Jerung Radar (Semua 3 Tier)
 * - Exclude saham yang ada harga crash >50% dalam tempoh backtest (data rosak/ticker bertukar)
 * - Exclude saham harga > RM100 (bluechip heavyweight bukan scope)
 * - Entry = harga pada hari pertama muncul dalam radar
 * - SL = floorLow * 0.97 (atau price * 0.95)
 * - Track: D+5, D+10, D+20, MaxGain, Latest P&L
 */

const fs = require('fs');
const path = require('path');
const histDir = path.join(__dirname, '../history');

// Load semua data
const files = fs.readdirSync(histDir).filter(f => f.endsWith('.json')).sort();
const allData = {};
for (const f of files) {
    let data; try { data = JSON.parse(fs.readFileSync(path.join(histDir, f), 'utf8')); } catch(e) { continue; }
    const list = Array.isArray(data) ? data : (data.topVolume || []);
    const date = f.replace('data_', '').replace('.json', '');
    allData[date] = {};
    for (const item of list) { if (item && item.name) allData[date][item.name] = item; }
}
const dates = Object.keys(allData).sort();

// Jerung Radar Filter (sama logic index.html)
function passesJerungRadar(item) {
    if (!item || !item.name || !item.price || item.price <= 0) return null;
    if (item.signal === 'avoid') return null;
    if (item.isCombStock) return null;
    const changeVal = item.changePct !== undefined ? item.changePct : (item.change || 0);
    if (changeVal > 5.0) return null;
    const pullback = item.pullback;
    if (pullback === null || pullback === undefined) return null;
    const closeTight = typeof item.closeTightness === 'number' ? item.closeTightness : 99;
    const touches = item.touchCount || 0;
    const isNearAthPath = pullback <= 15.0;
    const isSecondaryBasePath = pullback > 15.0 && pullback <= 30.0
        && closeTight <= 5.0 && touches >= 5 && changeVal < 3.0
        && (item.sma50 ? item.price >= item.sma50 : true);
    if (!isNearAthPath && !isSecondaryBasePath) return null;
    if (isNearAthPath && item.sma50 && item.price < item.sma50) return null;
    if ((item.turnover || 0) < 300000) return null;
    if (isNearAthPath && touches < 2) return null;
    const isTier1 = isNearAthPath && !item.hasVolumeSpike && item.isConsolidation === true && touches >= 3 && closeTight <= 5.0;
    const isTier2 = isNearAthPath && item.hasVolumeSpike && (item.volumeSpike || 0) < 3.0 && changeVal < 3.5 && closeTight <= 10.0;
    const isTier3 = isSecondaryBasePath;
    if (!isTier1 && !isTier2 && !isTier3) return null;
    return isTier1 ? 1 : (isTier2 ? 2 : 3);
}

// Backtest Engine
const trades = [];
const seenEntries = new Set();
const startIdx = dates.findIndex(d => d >= '2026-06-01');

// Exclude: harga > RM50, atau saham dengan data inconsistent (price bertukar drastik)
const PRICE_MAX = 50.0;

for (let i = startIdx; i < dates.length; i++) {
    const entryDate = dates[i];
    const dayData = allData[entryDate];

    for (const [name, item] of Object.entries(dayData)) {
        const tier = passesJerungRadar(item);
        if (!tier) continue;
        if (item.price > PRICE_MAX) continue; // exclude heavyweight

        if (seenEntries.has(name)) continue;
        seenEntries.add(name);

        const entryPrice = item.price;
        const floor = item.floorLow || (entryPrice * 0.95);
        const stopLoss = floor * 0.97;
        const slPct = ((stopLoss - entryPrice) / entryPrice) * 100;

        const outcomes = {};
        let hitSL = false, hitSLDate = null;
        let maxGainPct = 0, peakPrice = entryPrice;
        let isDataCorrupt = false;

        const futureDates = dates.slice(i + 1);

        for (let j = 0; j < futureDates.length && j < 25; j++) {
            const fd = futureDates[j];
            const fItem = allData[fd] && allData[fd][name];
            if (!fItem || !fItem.price || fItem.price <= 0) continue;

            const fprice = fItem.price;

            // Detect data corruption: harga bertukar lebih dari 60% dalam satu hari
            if (Math.abs(fprice - entryPrice) / entryPrice > 0.6 && j < 5) {
                isDataCorrupt = true;
                break;
            }

            const gainPct = ((fprice - entryPrice) / entryPrice) * 100;
            if (!hitSL && fprice <= stopLoss) { hitSL = true; hitSLDate = fd; }
            if (fprice > peakPrice) peakPrice = fprice;
            const curMax = ((peakPrice - entryPrice) / entryPrice) * 100;
            if (curMax > maxGainPct) maxGainPct = curMax;
            for (const n of [3,5,10,15,20]) {
                if (j + 1 === n && outcomes[n] === undefined) outcomes[n] = gainPct;
            }
        }

        if (isDataCorrupt) continue;

        let latestPrice = entryPrice, latestDate = entryDate;
        for (const fd of futureDates) {
            const fItem = allData[fd] && allData[fd][name];
            if (fItem && fItem.price > 0) { latestPrice = fItem.price; latestDate = fd; }
        }
        const latestGainPct = ((latestPrice - entryPrice) / entryPrice) * 100;

        trades.push({
            name, tier, entryDate, entryPrice, stopLoss, slPct,
            pullback: item.pullback,
            touches: item.touchCount || 0,
            closeTight: item.closeTightness,
            turnover: item.turnover || 0,
            d3: outcomes[3], d5: outcomes[5], d10: outcomes[10], d15: outcomes[15], d20: outcomes[20],
            maxGainPct, latestPrice, latestDate, latestGainPct, hitSL, hitSLDate
        });
    }
}

// Sort by latestGainPct
trades.sort((a, b) => b.latestGainPct - a.latestGainPct);

// Output
const line = '═'.repeat(95);
const dash = '─'.repeat(95);
console.log('\n' + line);
console.log('  📊 BACKTEST: JERUNG RADAR — Jun 2026 hingga 5 Ogos 2026');
console.log(line + '\n');
console.log(`Total trades bersih: ${trades.length} | Tier 1: ${trades.filter(t=>t.tier===1).length} | Tier 2: ${trades.filter(t=>t.tier===2).length} | Tier 3: ${trades.filter(t=>t.tier===3).length}`);
console.log('');

// Print trades
const pct = (v) => v !== undefined ? ((v >= 0 ? '+' : '') + v.toFixed(1) + '%').padStart(7) : '     -  ';
const hdr = 'Tier | Saham      | Entry     | RM      | SL%   | Touch | Tight | Pullbk |  D+5  |  D+10 | MaxGain | Latest   | Status';
console.log(hdr);
console.log('-'.repeat(hdr.length));

for (const t of trades) {
    const tierLabel = t.tier === 1 ? 'T1🔇' : (t.tier === 2 ? 'T2🦈' : 'T3🏗️');
    const sl = t.hitSL ? ('❌SL' + (t.hitSLDate ? '(' + t.hitSLDate.slice(5) + ')' : '')).padEnd(12) : '✅ Hold     ';
    const latest = (t.latestGainPct >= 0 ? '+' : '') + t.latestGainPct.toFixed(1) + '%';
    console.log(
        tierLabel.padEnd(5) + '| ' +
        t.name.padEnd(11) + '| ' +
        t.entryDate + ' | ' +
        ('RM' + t.entryPrice.toFixed(3)).padEnd(8) + '| ' +
        (t.slPct.toFixed(1) + '%').padEnd(6) + '| ' +
        String(t.touches).padEnd(6) + '| ' +
        (t.closeTight ? t.closeTight.toFixed(1) + '%' : '-  ').padEnd(6) + '| ' +
        (t.pullback ? t.pullback.toFixed(1) + '%' : '-  ').padEnd(7) + '|' +
        pct(t.d5) + '|' +
        pct(t.d10) + ' |' +
        ('+' + t.maxGainPct.toFixed(1) + '%').padStart(8) + ' | ' +
        latest.padEnd(9) + '| ' + sl
    );
}

// Statistik
function stats(list, label) {
    if (!list.length) return;
    const wins = list.filter(t => t.latestGainPct > 2.0); // winner = > +2%
    const losses = list.filter(t => t.latestGainPct <= 0);
    const breakeven = list.filter(t => t.latestGainPct > 0 && t.latestGainPct <= 2.0);
    const winRate = (wins.length / list.length * 100).toFixed(0);
    const avgW = wins.length ? (wins.reduce((a,t)=>a+t.latestGainPct,0)/wins.length).toFixed(1) : '0';
    const avgL = losses.length ? (losses.reduce((a,t)=>a+t.latestGainPct,0)/losses.length).toFixed(1) : '0';
    const avgMax = (list.reduce((a,t)=>a+t.maxGainPct,0)/list.length).toFixed(1);
    const slHits = list.filter(t=>t.hitSL).length;
    const rr = Math.abs(parseFloat(avgW)/parseFloat(avgL)).toFixed(1);
    console.log(`\n${label} (n=${list.length}):`);
    console.log(`  Win (>2%)     : ${wins.length} (${winRate}%)   Breakeven: ${breakeven.length}   Rugi: ${losses.length}`);
    console.log(`  Avg Gain (W)  : +${avgW}%`);
    console.log(`  Avg Loss (L)  : ${avgL}%`);
    console.log(`  Risk/Reward   : 1 : ${rr}`);
    console.log(`  Avg Max Gain  : +${avgMax}% (kalau timing keluar cantik)`);
    console.log(`  SL Kena       : ${slHits}/${list.length} (${(slHits/list.length*100).toFixed(0)}%)`);
    const sortedW = [...wins].sort((a,b)=>b.latestGainPct-a.latestGainPct);
    const sortedL = [...list].sort((a,b)=>a.latestGainPct-b.latestGainPct);
    console.log(`  Top 3 Winner  : ${sortedW.slice(0,3).map(t=>t.name+' +'+t.latestGainPct.toFixed(1)+'%').join(', ')}`);
    console.log(`  Top 3 Loser   : ${sortedL.slice(0,3).map(t=>t.name+' '+t.latestGainPct.toFixed(1)+'%').join(', ')}`);
}

console.log('\n' + dash);
console.log('STATISTIK KESELURUHAN');
console.log(dash);
stats(trades, '🔷 SEMUA TIER');
stats(trades.filter(t=>t.tier===1), '🔇 Tier 1: Quiet Accum');
stats(trades.filter(t=>t.tier===2), '🦈 Tier 2: Jerung Masuk');
stats(trades.filter(t=>t.tier===3), '🏗️ Tier 3: Second Base');
console.log('\n' + line + '\n');
