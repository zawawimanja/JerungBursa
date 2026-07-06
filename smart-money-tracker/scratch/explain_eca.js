const fs = require('fs');
const path = require('path');

const liveDataPath = path.join(__dirname, '../live_data.json');
if (!fs.existsSync(liveDataPath)) {
    console.error("❌ No live_data.json found!");
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const list = raw.topVolume || [];

// Constants from index.html
const ipoMap = {
    'SKYECHIP': 'A', 'PENTECH': 'A', 'ECOSHOP': 'A', 'EMPIRE': 'A', 'SRKK': 'A',
    'SUM': 'B', 'ELSA': 'B', 'NE': 'B', 'AMBEST': 'B', 'AMS': 'B',
    'EIPOWER': 'B', 'ISF': 'B', 'KEEMING': 'B', 'TEAMSTR': 'B', 'CBHB': 'B',
    'HEGROUP': 'B', 'MNHLDG': 'B', 'TMK': 'B', 'YEWLEE': 'B', 'HKB': 'B', 'UUE': 'B',
    'MMCS': 'C', 'GDGROUP': 'C', 'GOLDLI': 'C', 'HOCKSOON': 'C', 'OGX': 'C', 'SBS': 'C'
};

const freshIpos = [
    'SKYECHIP', 'PENTECH', 'SUM', 'ELSA', 'AMBEST', 'AMS',
    'EIPOWER', 'ISF', 'KEEMING', 'TEAMSTR', 'MMCS', 'GDGROUP',
    'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE'
];

function isFreshIpo(item) {
    if (!item) return false;
    
    // Inject grade if missing
    if (!item.ipoGrade) {
        item.ipoGrade = ipoMap[item.name.toUpperCase().trim()];
    }
    
    if (!item.ipoGrade) return false;
    
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return false;
    
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('AVOID')) return false;

    if (item.ipoYear !== undefined) {
        return item.ipoYear >= 2025;
    }

    const cleanName = item.name.toUpperCase().trim();
    return freshIpos.includes(cleanName) || Object.keys(ipoMap).some(key => {
        if (!freshIpos.includes(key)) return false;
        const normKey = key.replace(/[^A-Z0-9]/g, '');
        const normName = cleanName.replace(/[^A-Z0-9]/g, '');
        return normName.startsWith(normKey);
    });
}

function isSleepingOrAvoidStock(item) {
    if (!item) return false;
    if (isFreshIpo(item)) return false;
    if (item.isCombStock) return true;
    
    const setup = (item.setupName || '').toUpperCase();
    if (setup.includes('DOWNTREND') || setup.includes('AVOID') || setup === 'N/A') return true;
    
    const reason = (item.reason || '').toUpperCase();
    if (reason.includes('COMB') || reason.includes('AVOID') || reason.includes('ILLIQUID')) return true;
    
    return false;
}

function calculateSmartScore(item) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    
    // 1. Proximity to Floor (Safer Entry)
    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;
    
    // 2. Floor Strength (Support touches)
    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;
    
    // 3. Consolidation Base
    if (item.isConsolidation) score += 2;
    
    // 4. Zon Emas Pullback (ATH / RBS)
    if (pullbackVal <= 5.0) score += 3; // RBS/Near ATH
    else if (pullbackVal <= 12.0) score += 2; // Healthy pullback
    else if (pullbackVal <= 25.0) score += 1;
    
    // 5. SMA Trend Alignment
    const isAboveSma50 = item.sma50 ? price >= item.sma50 : false;
    const isAboveSma200 = item.sma200 ? price >= item.sma200 : false;
    if (isAboveSma50) score += 2;
    if (isAboveSma200) score += 1;
    
    // 6. High volume spike confirmation
    if (item.turnover >= 5000000) score += 1;
    
    // 7. Premium IPO Grade Booster
    // Ensure grade is present
    if (!item.ipoGrade) {
        item.ipoGrade = ipoMap[item.name.toUpperCase().trim()];
    }
    if (item.ipoGrade === 'A') score += 3;
    else if (item.ipoGrade === 'B') score += 2;
    else if (item.ipoGrade === 'C') score += 1;
    
    // 8. Momentum Booster
    if (pullbackVal <= 3.0 && isAboveSma50 && isAboveSma200) {
        score += 2;
    }
    
    return Math.min(15, score);
}

// Filter
let validPicks = list.filter(item => {
    // Inject grade if missing
    if (!item.ipoGrade) {
        item.ipoGrade = ipoMap[item.name.toUpperCase().trim()];
    }

    if (!item.high52) return false;
    const pullbackVal = item.pullback !== null ? item.pullback : 0;
    const isAboveSma200 = item.sma200 ? item.price >= item.sma200 : false;
    const isIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B' || item.ipoGrade === 'C';
    const isPremiumIpo = item.ipoGrade === 'A' || item.ipoGrade === 'B';
    const maxPullbackLimit = isIpo ? 55.0 : (isAboveSma200 ? 40.0 : 30.0);
    const hasPullback = pullbackVal >= 0.0 && pullbackVal <= maxPullbackLimit;
    if (!hasPullback) return false;

    if (isSleepingOrAvoidStock(item)) return false;
    if (item.price < 0.25 || item.price > 4.00) return false;
    
    const minTurnover = isIpo ? 400000 : 750000;
    if (item.turnover < minTurnover) return false;
    
    const minScore = isPremiumIpo ? 10 : (item.ipoGrade === 'C' ? 11 : 12);
    const itemScore = calculateSmartScore(item);
    if (itemScore < minScore) return false;

    const pct = item.changePct !== undefined ? item.changePct : item.change;
    const pb = item.pullback !== null ? item.pullback : 0;
    const style = item.setupStyle || (
        pct >= 5.0 || (pct >= 3.5 && pb > 5.0) ? 'EXPLOSIVE' : (
            pb <= 10.0 && (item.isConsolidation || (item.lowTightness && item.lowTightness <= 8.0) || (item.touchCount && item.touchCount >= 2)) ? 'STAIRCASE' : 'SWING PLAY'
        )
    );
    return style === 'EXPLOSIVE' || style === 'STAIRCASE' || isPremiumIpo;
});

// Sort
const renderSortFn = (a, b) => {
    const isPremiumIpoA = (a.ipoGrade === 'A' || a.ipoGrade === 'B') ? 1 : 0;
    const isPremiumIpoB = (b.ipoGrade === 'A' || b.ipoGrade === 'B') ? 1 : 0;

    if (isPremiumIpoB !== isPremiumIpoA) {
        return isPremiumIpoB - isPremiumIpoA;
    }

    const scoreA = calculateSmartScore(a);
    const scoreB = calculateSmartScore(b);
    const minScoreA = isPremiumIpoA ? 10 : 12;
    const minScoreB = isPremiumIpoB ? 10 : 12;
    const isVvipA = (a.isVvip && scoreA >= minScoreA) ? 1 : 0;
    const isVvipB = (b.isVvip && scoreB >= minScoreB) ? 1 : 0;

    if (isVvipB !== isVvipA) {
        return isVvipB - isVvipA;
    }
    if (scoreB !== scoreA) {
        return scoreB - scoreA;
    }

    const isIpoA = a.ipoGrade === 'A' || a.ipoGrade === 'B' || a.ipoGrade === 'C';
    const isIpoB = b.ipoGrade === 'A' || b.ipoGrade === 'B' || b.ipoGrade === 'C';
    if (isIpoA && isIpoB) {
        return a.turnover - b.turnover;
    }
    return b.turnover - a.turnover;
};

validPicks.sort(renderSortFn);

console.log(`=== ACTIVE TREND RIDERS (${validPicks.length} items) ===`);
validPicks.forEach((item, idx) => {
    const score = calculateSmartScore(item);
    console.log(`${idx+1}. Name: ${item.name.padEnd(8)} | Score: ${score}/15 | VVIP: ${item.isVvip} | Premium IPO: ${item.ipoGrade} | Price: ${item.price} | Turnover: ${(item.turnover/1e6).toFixed(3)}M | Setup: ${item.setupStyle}`);
});
