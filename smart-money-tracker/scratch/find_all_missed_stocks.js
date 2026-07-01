const fs = require('fs');
const path = require('path');

function findAllMissed() {
    const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_data.json'), 'utf8'));
    const stocks = rawData.topVolume || [];
    
    console.log(`Scanning all ${stocks.length} top volume stocks for missed bounce setups...`);
    console.log('='.repeat(110));
    console.log(`Counter   | Price | Change% | Pullback | SetupStyle | SetupName                    | Reason For Exclusion`);
    console.log('='.repeat(110));
    
    let count = 0;
    stocks.forEach(item => {
        if (item.name.includes('-')) return; // Skip warrants
        
        // Basic eligibility check
        const isBouncing = item.change > 0;
        const isPriceEligible = item.price >= 0.25 && item.price <= 4.00;
        const isLiquid = item.turnover >= 250000;
        const isNotComb = !item.isCombStock;
        
        if (!isBouncing || !isPriceEligible || !isLiquid || !isNotComb) {
            return;
        }
        
        // Check if currently shown on dashboard:
        const pullbackVal = item.pullback !== null ? item.pullback : 0;
        const hasPullback = pullbackVal >= 0.5 && pullbackVal <= 25.0;
        const isDowntrend = item.setupName && (
            item.setupName.includes('Downtrend') || 
            item.setupName.includes('Avoid') || 
            item.setupName === 'N/A'
        );
        const passBasic = hasPullback && !isDowntrend;
        const isShown = passBasic && (item.setupStyle === 'EXPLOSIVE' || item.setupStyle === 'STAIRCASE');
        
        if (!isShown) {
            // Determine exact exclusion reasons:
            const reasons = [];
            if (pullbackVal < 0.5) reasons.push(`Pullback too shallow (${pullbackVal.toFixed(2)}% < 0.5%)`);
            if (pullbackVal > 25.0) reasons.push(`Pullback too deep (${pullbackVal.toFixed(2)}% > 25.0%)`);
            if (isDowntrend) reasons.push(`Downtrend status (${item.setupName})`);
            if (item.setupStyle !== 'EXPLOSIVE' && item.setupStyle !== 'STAIRCASE') {
                reasons.push(`SetupStyle is ${item.setupStyle} (Only EXPLOSIVE/STAIRCASE allowed)`);
            }
            
            console.log(
                `${item.name.padEnd(9)} | ` +
                `${item.price.toFixed(3)} | ` +
                `+${item.changePct.toFixed(2)}% | ` +
                `${pullbackVal.toFixed(2)}% | ` +
                `${item.setupStyle.padEnd(10)} | ` +
                `${item.setupName.padEnd(28)} | ` +
                `${reasons.join(', ')}`
            );
            count++;
        }
    });
    
    console.log('='.repeat(110));
    console.log(`Total missed candidates: ${count}`);
}

findAllMissed();
