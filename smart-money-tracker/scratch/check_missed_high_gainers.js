const fs = require('fs');
const path = require('path');

const file30 = path.join(__dirname, '../history/data_2026-06-30.json');
const file01 = path.join(__dirname, '../history/data_2026-07-01.json');

const data30 = JSON.parse(fs.readFileSync(file30, 'utf8'));
const data01 = JSON.parse(fs.readFileSync(file01, 'utf8'));

const stocks30 = data30.topVolume || [];
const stocks01 = data01.topVolume || [];

// Find the highest gainers on July 1st (changePct >= 4%)
const highGainers01 = stocks01
    .filter(s => s.changePct >= 4.0 && s.price >= 0.25 && s.price <= 4.00 && s.turnover >= 250000 && !s.isCombStock)
    .sort((a, b) => b.changePct - a.changePct);

console.log(`=== TOP GAINERS ON JULY 1ST (ChangePct >= 4%) ===`);
console.log('Stock      | Change % | Price (1/7) | Turnover (1/7) | Triggered SOP on 30 Jun? | Reason if Missed');
console.log('-'.repeat(110));

highGainers01.forEach(g => {
    // Check if this stock was in stocks30
    const matched30 = stocks30.find(s => s.name === g.name);
    
    if (!matched30) {
        console.log(`${g.name.padEnd(10)} | ${g.changePct.toFixed(2)}% | RM ${g.price.toFixed(3)} | RM ${(g.turnover/1e6).toFixed(2)}M | NO | Tiada data pada 30 Jun`);
        return;
    }
    
    // Check if it triggered SOP on 30 Jun
    const pullbackVal = matched30.pullback !== null ? matched30.pullback : 0;
    const isAboveSma200 = matched30.sma200 ? matched30.price >= matched30.sma200 : false;
    const maxPullback = isAboveSma200 ? 40.0 : 30.0;
    
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullback;
    const isBouncing = matched30.change > 0;
    const isDowntrend = matched30.setupName && (
        matched30.setupName.includes('Downtrend') || 
        matched30.setupName.includes('Avoid') || 
        matched30.setupName === 'N/A'
    );
    
    const passFilters = hasPullback && 
           isBouncing && 
           !isDowntrend && 
           matched30.price >= 0.25 && matched30.price <= 4.00 && 
           matched30.turnover >= 250000 && 
           !matched30.isCombStock;
           
    const style = matched30.setupStyle;
    const isSopTrigger = passFilters && (style === 'EXPLOSIVE' || style === 'STAIRCASE');
    
    if (isSopTrigger) {
        console.log(`${g.name.padEnd(10)} | ${g.changePct.toFixed(2)}% | RM ${g.price.toFixed(3)} | RM ${(g.turnover/1e6).toFixed(2)}M | YES | Triggered as ${style} (Turnover 30 Jun: RM ${(matched30.turnover/1e6).toFixed(2)}M)`);
    } else {
        const reasons = [];
        if (!hasPullback) reasons.push(`Pullback is ${pullbackVal.toFixed(2)}% (Max allowed is ${maxPullback}%)`);
        if (!isBouncing) reasons.push(`No reversal bounce (Close change <= 0, Close was RM ${matched30.price.toFixed(3)} [${matched30.changePct.toFixed(2)}%])`);
        if (isDowntrend) reasons.push(`Setup style is Downtrend/Avoid (${matched30.setupName})`);
        if (matched30.price < 0.25 || matched30.price > 4.00) reasons.push(`Price RM ${matched30.price.toFixed(3)} out of RM 0.25 - 4.00 range`);
        if (matched30.turnover < 250000) reasons.push(`Turnover RM ${(matched30.turnover/1e6).toFixed(3)}M < RM 0.25M`);
        if (matched30.isCombStock) reasons.push(`Comb / Illiquid stock`);
        if (style !== 'EXPLOSIVE' && style !== 'STAIRCASE') reasons.push(`SetupStyle is ${style || 'SWING PLAY'}`);
        
        console.log(`${g.name.padEnd(10)} | ${g.changePct.toFixed(2)}% | RM ${g.price.toFixed(3)} | RM ${(g.turnover/1e6).toFixed(2)}M | NO | ${reasons.join(', ')}`);
    }
});
