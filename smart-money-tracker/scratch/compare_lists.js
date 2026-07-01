const fs = require('fs');
const path = require('path');

const watchlist = [
    'HKB', 'DNEX', 'SUM', 'SKYECHIP', 'CHEEDING', 'OPPSTAR', 'ELRIDGE', 'CTOS',
    'MMCS', 'AMS', 'CNERGEN', 'CBHB', 'KEEMING', 'EIPOWER', 'SUNMED', 'MNHLDG',
    'LWSABAH', 'MCLEAN', 'AMBEST', 'ADNEX', 'PENTECH', 'SDCG', 'OGX', 'NE',
    'SAM', 'TMK', 'IAB', 'EXSIMHB'
];

function compare() {
    const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, '../live_data.json'), 'utf8'));
    const stocks = rawData.topVolume || [];
    
    console.log(`Checking watchlist items against live_data.json (using Smart Filter rules):`);
    console.log('='.repeat(100));
    console.log(`Counter   | Price | Change% | Pullback | SetupStyle | SetupName                    | In Dashboard?`);
    console.log('='.repeat(100));
    
    watchlist.forEach(name => {
        let matched = stocks.find(s => s.name === name);
        if (!matched && name === 'SKYECHIP') {
            // handle spelling difference
            matched = stocks.find(s => s.name === 'SKYCHIP');
        }
        
        if (matched) {
            const pct = matched.changePct !== undefined ? matched.changePct : 0;
            const pb = matched.pullback !== null ? matched.pullback : 0;
            
            // Check if it would be shown on dashboard:
            const pullbackVal = matched.pullback !== null ? matched.pullback : 0;
            const isAboveSma200 = matched.sma200 ? matched.price >= matched.sma200 : false;
            const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
            const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
            
            const isBouncing = matched.change > 0;
            const isDowntrend = matched.setupName && (
                matched.setupName.includes('Downtrend') || 
                matched.setupName.includes('Avoid') || 
                matched.setupName === 'N/A'
            );
            const passBasic = hasPullback && 
                   isBouncing && 
                   !isDowntrend && 
                   matched.price >= 0.25 && matched.price <= 4.00 && 
                   matched.turnover >= 250000 && 
                   !matched.isCombStock;
                   
            const onDashboard = passBasic && (matched.setupStyle === 'EXPLOSIVE' || matched.setupStyle === 'STAIRCASE');
            
            console.log(
                `${name.padEnd(9)} | ` +
                `${matched.price.toFixed(3)} | ` +
                `${(pct >= 0 ? '+' : '')}${pct.toFixed(2)}% | ` +
                `${pb.toFixed(2)}% | ` +
                `${matched.setupStyle.padEnd(10)} | ` +
                `${matched.setupName.padEnd(28)} | ` +
                `${onDashboard ? '✅ YA' : '❌ TIDAK'}`
            );
        } else {
            console.log(`${name.padEnd(9)} | TIDAK DIJUMPAI DALAM LIVE_DATA.JSON`);
        }
    });
    console.log('='.repeat(100));
}

compare();
