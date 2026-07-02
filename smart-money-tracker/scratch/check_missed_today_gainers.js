const fs = require('fs');
const path = require('path');

const file01 = path.join(__dirname, '../history/data_2026-07-01.json');
const fileLive = path.join(__dirname, '../live_data.json');

const data01 = JSON.parse(fs.readFileSync(file01, 'utf8'));
const dataLive = JSON.parse(fs.readFileSync(fileLive, 'utf8'));

const stocks01 = data01.topVolume || [];
const stocksLive = dataLive.topVolume || [];

// Find the highest gainers today (2/7) with changePct >= 3.0%
const highGainersLive = stocksLive
    .filter(s => s.changePct >= 3.0 && s.price >= 0.25 && s.price <= 4.00 && s.turnover >= 250000 && !s.isCombStock)
    .sort((a, b) => b.changePct - a.changePct);

console.log(`=== TOP GAINERS TODAY (2/7) ===`);
console.log('Stock      | Change % | Price (2/7) | Turnover (2/7) | Triggered SOP on 1 Jul? | Reason if Missed');
console.log('-'.repeat(110));

highGainersLive.forEach(g => {
    // Check if this stock was in stocks01
    const matched01 = stocks01.find(s => s.name === g.name);
    
    if (!matched01) {
        console.log(`${g.name.padEnd(10)} | ${g.changePct.toFixed(2)}% | RM ${g.price.toFixed(3)} | RM ${(g.turnover/1e6).toFixed(2)}M | NO | Tiada data pada 1 Julai`);
        return;
    }
    
    // Check if it triggered SOP on 1 Jul
    const pullbackVal = matched01.pullback !== null ? matched01.pullback : 0;
    const isAboveSma200 = matched01.sma200 ? matched01.price >= matched01.sma200 : false;
    const maxPullback = isAboveSma200 ? 40.0 : 30.0;
    
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullback;
    const isBouncing = matched01.change > 0;
    const isDowntrend = matched01.setupName && (
        matched01.setupName.includes('Downtrend') || 
        matched01.setupName.includes('Avoid') || 
        matched01.setupName === 'N/A'
    );
    
    const passFilters = hasPullback && 
           isBouncing && 
           !isDowntrend && 
           matched01.price >= 0.25 && matched01.price <= 4.00 && 
           matched01.turnover >= 250000 && 
           !matched01.isCombStock;
           
    const style = matched01.setupStyle;
    const isSopTrigger = passFilters && (style === 'EXPLOSIVE' || style === 'STAIRCASE');
    
    if (isSopTrigger) {
        console.log(`${g.name.padEnd(10)} | ${g.changePct.toFixed(2)}% | RM ${g.price.toFixed(3)} | RM ${(g.turnover/1e6).toFixed(2)}M | YES | Triggered as ${style} (Turnover 1 Jul: RM ${(matched01.turnover/1e6).toFixed(2)}M)`);
    } else {
        const reasons = [];
        if (!hasPullback) reasons.push(`Pullback is ${pullbackVal.toFixed(2)}% (Max allowed is ${maxPullback}%)`);
        if (!isBouncing) reasons.push(`No reversal bounce (Close change <= 0, Close was RM ${matched01.price.toFixed(3)} [${matched01.changePct.toFixed(2)}%])`);
        if (isDowntrend) reasons.push(`Setup style is Downtrend/Avoid (${matched01.setupName})`);
        if (matched01.price < 0.25 || matched01.price > 4.00) reasons.push(`Price RM ${matched01.price.toFixed(3)} out of RM 0.25 - 4.00 range`);
        if (matched01.turnover < 250000) reasons.push(`Turnover RM ${(matched01.turnover/1e6).toFixed(3)}M < RM 0.25M`);
        if (matched01.isCombStock) reasons.push(`Comb / Illiquid stock`);
        if (style !== 'EXPLOSIVE' && style !== 'STAIRCASE') reasons.push(`SetupStyle is ${style || 'SWING PLAY'}`);
        
        console.log(`${g.name.padEnd(10)} | ${g.changePct.toFixed(2)}% | RM ${g.price.toFixed(3)} | RM ${(g.turnover/1e6).toFixed(2)}M | NO | ${reasons.join(', ')}`);
    }
});
