const fs = require('fs');
const path = require('path');

function testRelaxation() {
    const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_data.json'), 'utf8'));
    const stocks = rawData.topVolume || [];
    
    console.log(`Jumlah keseluruhan kaunter dalam topVolume: ${stocks.length}`);
    
    console.log('\n------------------------------------------------------------');
    console.log('1. Kaunter sedia ada dalam Reversal List (had pullback <= 25%, no Downtrend/Avoid):');
    console.log('------------------------------------------------------------');
    
    const existingList = [];
    stocks.forEach(item => {
        if (!item.high52) return;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const hasPullback = pullbackVal >= 0.5 && pullbackVal <= 25.0;
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
               
        if (passBasic) {
            existingList.push(item);
        }
    });
    
    existingList.forEach(s => {
        console.log(`- ${s.name} | Price: RM ${s.price.toFixed(3)} | Pullback: ${s.pullback.toFixed(2)}% | Style: ${s.setupStyle}`);
    });
    console.log(`Total: ${existingList.length} kaunter.`);

    console.log('\n------------------------------------------------------------');
    console.log('2. Calon Baru jika kita benarkan Pullback <= 40% (Dengan syarat price >= sma50 & bouncing):');
    console.log('------------------------------------------------------------');
    
    const relaxedList = [];
    stocks.forEach(item => {
        if (!item.high52) return;
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        
        // Relaxed pullback limit up to 40%
        const hasPullback = pullbackVal >= 0.5 && pullbackVal <= 40.0;
        const isBouncing = item.change > 0;
        
        // Dynamic Downtrend definition: only downtrend if price < sma50
        // (Instead of raw setupName which has the hard pullback > 30.0 limit)
        const isSmaDowntrend = item.price < item.sma50; 
        
        const passBasic = hasPullback && 
               isBouncing && 
               !isSmaDowntrend && 
               item.price >= 0.25 && item.price <= 4.00 && 
               item.turnover >= 250000 && 
               !item.isCombStock;
               
        if (passBasic) {
            // check if not already in existingList
            if (!existingList.some(e => e.name === item.name)) {
                relaxedList.push(item);
            }
        }
    });
    
    relaxedList.forEach(s => {
        const smaVal = s.sma50 ? `RM ${s.sma50.toFixed(3)}` : 'N/A';
        console.log(`- ${s.name} | Price: RM ${s.price.toFixed(3)} | Pullback: ${s.pullback.toFixed(2)}% | SMA50: ${smaVal} | Turnover: RM ${(s.turnover/1e6).toFixed(2)}M`);
    });
    console.log(`Total Calon Baru: ${relaxedList.length} kaunter.`);
}

testRelaxation();
