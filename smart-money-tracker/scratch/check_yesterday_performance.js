const fs = require('fs');
const path = require('path');

const file30 = 'c:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/JerungBursa/smart-money-tracker/history/data_2026-06-30.json';
const file01 = 'c:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/JerungBursa/smart-money-tracker/history/data_2026-07-01.json';

const data30 = JSON.parse(fs.readFileSync(file30, 'utf8'));
const data01 = JSON.parse(fs.readFileSync(file01, 'utf8'));

const stocks30 = Array.isArray(data30) ? data30 : (data30.topVolume || []);
const stocks01 = Array.isArray(data01) ? data01 : (data01.topVolume || []);

// Filter candidate reversals from June 30th
const candidates30 = stocks30.filter(item => {
    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const hasPullback = pullbackVal >= 0.5 && pullbackVal <= 25.0;
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

console.log('=== PRESTASI SWING (ENTRY: 30 JUN -> RESULT: 1 JULAI) ===');
console.log('---------------------------------------------------------');
console.log('Nama Saham | Setup 30/6 | Price 30/6 | Price 1/7 | Return (%)');
console.log('---------------------------------------------------------');

let wins = 0;
let losses = 0;
let totalReturn = 0;

candidates30.forEach(item => {
    const changePct = item.changePct !== undefined ? item.changePct : 0;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    let style = 'SWING PLAY';
    if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
        style = 'EXPLOSIVE';
    } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
        style = 'STAIRCASE';
    }
    
    // Only look at EXPLOSIVE and STAIRCASE
    if (style === 'EXPLOSIVE' || style === 'STAIRCASE') {
        const match = stocks01.find(s => s.name === item.name);
        if (match) {
            const price30 = item.price;
            const price01 = match.price;
            const ret = ((price01 - price30) / price30) * 100;
            
            totalReturn += ret;
            if (ret > 0) wins++;
            else if (ret < 0) losses++;
            
            console.log(`${item.name.padEnd(10)} | ${style.padEnd(9)} | RM ${price30.toFixed(3)} | RM ${price01.toFixed(3)} | ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%`);
        } else {
            console.log(`${item.name.padEnd(10)} | ${style.padEnd(9)} | RM ${item.price.toFixed(3)} | N/A (Tiada Volum Hari Ini)`);
        }
    }
});

const totalTrades = wins + losses;
console.log('---------------------------------------------------------');
console.log(`Jumlah Trade Aktif: ${totalTrades}`);
console.log(`Untung (Profit): ${wins} | Rugi (Loss): ${losses} | Seri: ${totalTrades - wins - losses}`);
console.log(`Kadar Kemenangan Hari Ini (Win Rate): ${totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0}%`);
console.log(`Purata Pulangan 1 Hari: ${totalTrades > 0 ? (totalReturn / totalTrades).toFixed(2) : 0}%`);
