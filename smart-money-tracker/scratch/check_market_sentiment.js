const fs = require('fs');
const path = require('path');

const histDir = path.join(__dirname, '..', 'history');
const files = fs.readdirSync(histDir)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort()
    .slice(-8); // last 8 files

console.log('=== LAPORAN SENTIMEN PASARAN BURSA (22 JUN -> 30 JUN) ===');
console.log('---------------------------------------------------------');
console.log('Tarikh     | Jumlah Saham | Saham Hijau (%) | Purata Chg (%) | Isyarat Setup');
console.log('---------------------------------------------------------');

files.forEach(file => {
    const dateStr = file.replace('data_', '').replace('.json', '');
    const raw = fs.readFileSync(path.join(histDir, file), 'utf8');
    const data = JSON.parse(raw);
    const stocks = Array.isArray(data) ? data : (data.topVolume || []);
    
    if (stocks.length === 0) return;
    
    const greenStocks = stocks.filter(s => s.change > 0).length;
    const greenPct = (greenStocks / stocks.length) * 100;
    
    const totalChg = stocks.reduce((sum, s) => sum + (s.changePct || 0), 0);
    const avgChg = totalChg / stocks.length;
    
    // Count setups triggered on this day
    const setups = stocks.filter(item => {
        if (!item.high52) return false;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const hasPullback = pullbackVal >= 0.5 && pullbackVal <= 25.0;
        const isBouncing = item.change > 0;
        const isDowntrend = item.setupName && (
            item.setupName.includes('Downtrend') || 
            item.setupName.includes('Avoid') || 
            item.setupName === 'N/A'
        );
        const passBasic = hasPullback && isBouncing && !isDowntrend && 
                          item.price >= 0.25 && item.price <= 4.00 && 
                          item.turnover >= 250000 && !item.isCombStock;
                          
        if (!passBasic) return false;
        
        const changePct = item.changePct !== undefined ? item.changePct : 0;
        let style = 'SWING PLAY';
        if (changePct >= 5.0 || (changePct >= 3.5 && pullbackVal > 5.0)) {
            style = 'EXPLOSIVE';
        } else if (pullbackVal <= 10.0 && (item.isConsolidation || item.lowTightness <= 8.0 || item.touchCount >= 2)) {
            style = 'STAIRCASE';
        }
        return style === 'EXPLOSIVE' || style === 'STAIRCASE';
    }).length;

    console.log(`${dateStr} | ${stocks.length.toString().padEnd(12)} | ${greenPct.toFixed(1).padEnd(6)}% (${greenStocks}) | ${avgChg >= 0 ? '+' : ''}${avgChg.toFixed(2).padEnd(5)}% | ${setups} setups`);
});
