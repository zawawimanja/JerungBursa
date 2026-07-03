const fs = require('fs');
const path = require('path');
const vm = require('vm');

const liveDataJs = fs.readFileSync(path.join(__dirname, '../live_data.js'), 'utf8');
const sandbox = {
    window: {},
    console: {
        log: (...args) => console.log('[LOG]:', ...args),
        warn: (...args) => console.warn('[WARN]:', ...args),
        error: (...args) => console.error('[ERROR]:', ...args)
    }
};
sandbox.window = sandbox;
sandbox.addEventListener = () => {};
sandbox.window.addEventListener = () => {};

vm.runInNewContext(liveDataJs, sandbox);
const data = sandbox.window.liveData.topVolume || [];

const ipoMap = {
    'SKYECHIP': 'A', 'PENTECH': 'A', 'ECOSHOP': 'A', 'EMPIRE': 'A', 'SRKK': 'A',
    'SUM': 'B', 'ELSA': 'B', 'NE': 'B', 'AMBEST': 'B', 'AMS': 'B',
    'EIPOWER': 'B', 'ISF': 'B', 'KEEMING': 'B', 'TEAMSTR': 'B', 'CBHB': 'B',
    'HEGROUP': 'B', 'MNHLDG': 'B', 'TMK': 'B', 'YEWLEE': 'B', 'HKB': 'B', 'UUE': 'B',
    'MMCS': 'C', 'GDGROUP': 'C', 'GOLDLI': 'C', 'HOCKSOON': 'C', 'OGX': 'C', 'SBS': 'C'
};

data.forEach(item => {
    if (!item.ipoGrade) {
        const cleanName = item.name.toUpperCase().trim();
        if (ipoMap[cleanName]) {
            item.ipoGrade = ipoMap[cleanName];
        } else {
            const foundKey = Object.keys(ipoMap).find(key => {
                const normKey = key.replace(/[^A-Z0-9]/g, '');
                const normName = cleanName.replace(/[^A-Z0-9]/g, '');
                return normName.includes(normKey) || normKey.includes(normName);
            });
            if (foundKey) {
                item.ipoGrade = ipoMap[foundKey];
            }
        }
    }
});

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
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
    
    return score;
}

function isSleepingOrAvoidStock(item) {
    if (!item) return false;
    const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
    if (isIpo) return false;
    if (item.isCombStock) return true;
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('COMB') || reason.includes('AVOID') || reason.includes('ILLIQUID')) return true;
    return false;
}

console.log("Debugging items:");
data.forEach(item => {
    const score = calculateSmartScore(item);
    const pb = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
    const isPremiumIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B';
    const maxPullbackLimit = isIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
    const hasPullback = pb >= 0.0 && pb <= maxPullbackLimit;
    const isSleeping = isSleepingOrAvoidStock(item);
    const minTurnover = isIpo ? 400000 : 750000;
    const minScore = isPremiumIpo ? 10 : (item.ipoGrade === 'C' ? 11 : 12);
    
    const passPullback = hasPullback;
    const passSleeping = !isSleeping;
    const passPrice = item.price >= 0.25 && item.price <= 4.00;
    const passTurnover = item.turnover >= minTurnover;
    const passScore = score >= minScore;
    
    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    const passStyle = style === 'EXPLOSIVE' || style === 'STAIRCASE' || isPremiumIpo;

    if (passPullback && passSleeping && passPrice && passTurnover && passScore && passStyle) {
        console.log(`✅ MATCH: ${item.name} | Score: ${score}/${minScore} | Turnover: ${(item.turnover/1e6).toFixed(2)}M | Style: ${style} | IPO: ${item.ipoGrade || 'None'}`);
    } else if (item.name === 'SCGBHD' || item.name === 'UUE' || item.name === 'MNHLDG') {
        console.log(`❌ FAIL: ${item.name} | Score: ${score}/${minScore} (Pass: ${passScore}) | Turnover: ${(item.turnover/1e6).toFixed(2)}M (Pass: ${passTurnover}) | Style: ${style} (Pass: ${passStyle}) | Price: ${item.price} (Pass: ${passPrice}) | Pullback: ${pb} (Pass: ${passPullback}) | Sleeping: ${isSleeping} (Pass: ${passSleeping})`);
    }
});
