const fs = require('fs');
const path = require('path');

const file01 = path.join(__dirname, '../history/data_2026-07-01.json');
const fileLive = path.join(__dirname, '../live_data.json');

if (!fs.existsSync(file01) || !fs.existsSync(fileLive)) {
    console.error("❌ Fail July 1st data atau Live data tidak dijumpai.");
    process.exit(1);
}

const data01 = JSON.parse(fs.readFileSync(file01, 'utf8'));
const dataLive = JSON.parse(fs.readFileSync(fileLive, 'utf8'));

const stocks01 = Array.isArray(data01) ? data01 : (data01.topVolume || []);
const stocksLive = Array.isArray(dataLive) ? dataLive : (dataLive.topVolume || []);

const candidates01 = stocks01.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    
    const isBouncing = item.change > 0;
    const isDowntrend = item.setupName && (
        item.setupName.includes('Downtrend') || 
        item.setupName.includes('Avoid') || 
        item.setupName === 'N/A'
    );
    
    return hasPullback && isBouncing && !isDowntrend && 
           item.price >= 0.25 && item.price <= 4.00 && 
           item.turnover >= 250000 && !item.isCombStock;
});

console.log('=== PRESTASI HARI INI (ENTRY: CLOSE 1 JULAI -> LIVE PRICE 2 JULAI) ===');
console.log('---------------------------------------------------------------------------------');
console.log('Nama Saham | Setup 1/7   | Price 1/7  | Live 2/7   | Return (%) | Turnover 1/7');
console.log('---------------------------------------------------------------------------------');

let wins = 0;
let losses = 0;
let totalReturn = 0;
const results = [];

candidates01.forEach(item => {
    const changePct = item.changePct !== undefined ? item.changePct : 0;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    let style = 'SWING PLAY';
    if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
        style = 'EXPLOSIVE';
    } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
        style = 'STAIRCASE';
    }
    
    if (style === 'EXPLOSIVE' || style === 'STAIRCASE') {
        const match = stocksLive.find(s => s.name === item.name);
        if (match) {
            const price01 = item.price;
            const priceLive = match.price;
            const ret = ((priceLive - price01) / price01) * 100;
            
            results.push({
                name: item.name,
                style: style,
                price01: price01,
                priceLive: priceLive,
                ret: ret,
                turnover: item.turnover
            });
        }
    }
});

// Sort results by return descending
results.sort((a, b) => b.ret - a.ret);

results.forEach(r => {
    if (r.ret > 0) wins++;
    else if (r.ret < 0) losses++;
    totalReturn += r.ret;
    
    console.log(
        `${r.name.padEnd(10)} | ` +
        `${r.style.padEnd(11)} | ` +
        `RM ${r.price01.toFixed(3)} | ` +
        `RM ${r.priceLive.toFixed(3)} | ` +
        `${r.ret >= 0 ? '+' : ''}${r.ret.toFixed(2)}%`.padEnd(10) + ' | ' +
        `RM ${r.turnover.toLocaleString(undefined, {maximumFractionDigits:0})}`
    );
});

const totalTrades = wins + losses;
console.log('---------------------------------------------------------------------------------');
console.log(`Jumlah Trade Aktif: ${results.length}`);
console.log(`Untung (Profit): ${wins} | Rugi (Loss): ${losses} | Seri: ${results.length - wins - losses}`);
console.log(`Kadar Kemenangan Hari Ini (Win Rate): ${totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0}%`);
console.log(`Purata Pulangan 1 Hari: ${results.length > 0 ? (totalReturn / results.length).toFixed(2) : 0}%`);
console.log('---------------------------------------------------------------------------------');
