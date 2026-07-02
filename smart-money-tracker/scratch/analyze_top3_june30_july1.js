const fs = require('fs');
const path = require('path');

const file30 = path.join(__dirname, '../history/data_2026-06-30.json');
const file01 = path.join(__dirname, '../history/data_2026-07-01.json');
const fileLive = path.join(__dirname, '../live_data.json');

const data30 = JSON.parse(fs.readFileSync(file30, 'utf8'));
const data01 = JSON.parse(fs.readFileSync(file01, 'utf8'));
const dataLive = JSON.parse(fs.readFileSync(fileLive, 'utf8'));

const stocks30 = data30.topVolume || [];
const stocks01 = data01.topVolume || [];
const stocksLive = dataLive.topVolume || [];

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const changePct = item.changePct !== undefined ? item.changePct : 0;
    
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;
    
    if (item.isConsolidation) score += 2;
    
    if (pullbackVal <= 5.0) score += 3;
    else if (pullbackVal <= 12.0) score += 2;
    else if (pullbackVal <= 25.0) score += 1;
    
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    if (item.turnover >= 5000000) score += 1;
    
    return score;
}

function getTop3(stocksList) {
    const dayCandidates = [];
    stocksList.forEach(item => {
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
        const maxPullback = isAboveSma200 ? 40.0 : 30.0;
        
        const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullback;
        const isBouncing = item.change > 0;
        const isDowntrend = item.setupName && (
            item.setupName.includes('Downtrend') || 
            item.setupName.includes('Avoid') || 
            item.setupName === 'N/A'
        );
        
        const passFilters = hasPullback && 
               isBouncing && 
               !isDowntrend && 
               item.price >= 0.25 && item.price <= 4.00 && 
               item.turnover >= 1500000 && 
               !item.isCombStock;
               
        if (!passFilters) return;
        
        let style = 'SWING PLAY';
        const changePct = item.changePct !== undefined ? item.changePct : 0;
        if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
            style = 'EXPLOSIVE';
        } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
            style = 'STAIRCASE';
        }
        
        if (style === 'EXPLOSIVE' || style === 'STAIRCASE') {
            const score = calculateSmartScore(item);
            dayCandidates.push({
                name: item.name,
                style: style,
                price: item.price,
                turnover: item.turnover,
                score: score,
                pullback: pullbackVal
            });
        }
    });
    
    const explosives = dayCandidates.filter(c => c.style === 'EXPLOSIVE');
    const staircases = dayCandidates.filter(c => c.style === 'STAIRCASE');
    
    const sortFn = (a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.turnover - a.turnover;
    };
    
    explosives.sort(sortFn);
    staircases.sort(sortFn);
    
    return {
        explosives: explosives.slice(0, 3),
        staircases: staircases.slice(0, 3)
    };
}

console.log('==================================================');
console.log('🔍 ANALISIS PRESTASI PILIHAN TOP 3 (30 JUN & 1 JULAI)');
console.log('==================================================');

// 1. June 30th Picks (Exit July 1st)
const picks30 = getTop3(stocks30);
console.log('\n📅 ISYARAT MASUK: 30 JUN (TUTUP) ➡️ KEPUTUSAN: 1 JULAI (TUTUP)');
console.log('\n--- 🚀 EXPLOSIVES ---');
picks30.explosives.forEach((p, idx) => {
    const match = stocks01.find(s => s.name === p.name);
    const ret = match ? ((match.price - p.price) / p.price * 100) : 0;
    const retSign = ret >= 0 ? '+' : '';
    console.log(`${idx+1}. ${p.name.padEnd(10)} | RM ${p.price.toFixed(3)} ➡️ ${match ? 'RM ' + match.price.toFixed(3) : 'N/A'} | Return: ${retSign}${ret.toFixed(2)}% | Score: ${p.score}`);
});

console.log('\n--- 🪜 STAIRCASES ---');
picks30.staircases.forEach((p, idx) => {
    const match = stocks01.find(s => s.name === p.name);
    const ret = match ? ((match.price - p.price) / p.price * 100) : 0;
    const retSign = ret >= 0 ? '+' : '';
    console.log(`${idx+1}. ${p.name.padEnd(10)} | RM ${p.price.toFixed(3)} ➡️ ${match ? 'RM ' + match.price.toFixed(3) : 'N/A'} | Return: ${retSign}${ret.toFixed(2)}% | Score: ${p.score}`);
});

// 2. July 1st Picks (Exit July 2nd Live)
const picks01 = getTop3(stocks01);
console.log('\n\n📅 ISYARAT MASUK: 1 JULAI (TUTUP) ➡️ KEPUTUSAN: 2 JULAI (LIVE 9:30 AM)');
console.log('\n--- 🚀 EXPLOSIVES ---');
picks01.explosives.forEach((p, idx) => {
    const match = stocksLive.find(s => s.name === p.name);
    const ret = match ? ((match.price - p.price) / p.price * 100) : 0;
    const retSign = ret >= 0 ? '+' : '';
    console.log(`${idx+1}. ${p.name.padEnd(10)} | RM ${p.price.toFixed(3)} ➡️ ${match ? 'RM ' + match.price.toFixed(3) : 'N/A'} | Return: ${retSign}${ret.toFixed(2)}% | Score: ${p.score}`);
});

console.log('\n--- 🪜 STAIRCASES ---');
picks01.staircases.forEach((p, idx) => {
    const match = stocksLive.find(s => s.name === p.name);
    const ret = match ? ((match.price - p.price) / p.price * 100) : 0;
    const retSign = ret >= 0 ? '+' : '';
    console.log(`${idx+1}. ${p.name.padEnd(10)} | RM ${p.price.toFixed(3)} ➡️ ${match ? 'RM ' + match.price.toFixed(3) : 'N/A'} | Return: ${retSign}${ret.toFixed(2)}% | Score: ${p.score}`);
});
console.log('==================================================');
