const fs = require('fs');
const path = require('path');

function testJune30ToJuly1() {
    const june30Path = path.join(__dirname, '../history/data_2026-06-30.json');
    const july1Path = path.join(__dirname, '../history/data_2026-07-01.json');
    
    if (!fs.existsSync(june30Path) || !fs.existsSync(july1Path)) {
        console.error("❌ Fail sejarah June 30 atau July 1 tiada!");
        return;
    }
    
    const june30Data = JSON.parse(fs.readFileSync(june30Path, 'utf8'));
    const july1Data = JSON.parse(fs.readFileSync(july1Path, 'utf8'));
    
    const june30Stocks = june30Data.topVolume || [];
    const july1Stocks = july1Data.topVolume || [];
    
    // Filter out candidates that triggered on June 30
    const triggers = june30Stocks.filter(item => {
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
        
        const passBasic = hasPullback && 
               isBouncing && 
               !isDowntrend && 
               item.price >= 0.25 && item.price <= 4.00 && 
               item.turnover >= 250000 && 
               !item.isCombStock;
               
        if (!passBasic) return false;
        
        const setupStyle = item.setupStyle;
        return setupStyle === 'EXPLOSIVE' || setupStyle === 'STAIRCASE';
    });
    
    console.log(`📊 PANTAS BACKTEST 1-HARI (Beli Close 30 Jun, Jual Close 1 Jul):`);
    console.log('='.repeat(105));
    console.log(`Counter   | Style      | Harga Beli (30 Jun) | Harga Jual (1 Jul) | Perubahan % | Keputusan`);
    console.log('='.repeat(105));
    
    let total = 0;
    let wins = 0;
    let totalReturn = 0;
    
    triggers.forEach(t => {
        const matchedToday = july1Stocks.find(s => s.name === t.name);
        if (matchedToday) {
            const buyPrice = t.price;
            const sellPrice = matchedToday.price;
            const ret = ((sellPrice - buyPrice) / buyPrice) * 100;
            const isWin = ret > 0;
            
            total++;
            if (isWin) wins++;
            totalReturn += ret;
            
            console.log(
                `${t.name.padEnd(9)} | ` +
                `${t.setupStyle.padEnd(10)} | ` +
                `RM ${buyPrice.toFixed(3).padEnd(16)} | ` +
                `RM ${sellPrice.toFixed(3).padEnd(16)} | ` +
                `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%`.padEnd(11) + ` | ` +
                `${isWin ? '✅ WIN' : '❌ LOSS'}`
            );
        } else {
            console.log(`${t.name.padEnd(9)} | TIADA DATA PADA 1 JULAI`);
        }
    });
    
    console.log('='.repeat(105));
    if (total > 0) {
        const winrate = (wins / total) * 100;
        const avgReturn = totalReturn / total;
        console.log(`📈 Keputusan Keseluruhan:`);
        console.log(`   - Jumlah Posisi : ${total}`);
        console.log(`   - Menang        : ${wins}`);
        console.log(`   - Kalah         : ${total - wins}`);
        console.log(`   - Win Rate      : ${winrate.toFixed(1)}%`);
        console.log(`   - Purata Return : ${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}%`);
    } else {
        console.log(`Tiada isyarat beli dikesan pada 30 Jun.`);
    }
    console.log('='.repeat(105));
}

testJune30ToJuly1();
