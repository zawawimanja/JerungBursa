const fs = require('fs');
const path = require('path');

// Load backtest.html
const backtestFile = path.join(__dirname, '../backtest.html');
if (!fs.existsSync(backtestFile)) {
    console.error("backtest.html not found!");
    process.exit(1);
}

const html = fs.readFileSync(backtestFile, 'utf8');

// Extract fullData array
const match = html.match(/const\s+fullData\s*=\s*(\[[\s\S]*?\]);/);
if (!match) {
    console.error("Could not find fullData array!");
    process.exit(1);
}

const fullData = eval(match[1]);

// Map grades
const ipoMap = {
    'SKYECHIP': 'A', 'PENTECH': 'A', 'ECOSHOP': 'A', 'EMPIRE': 'A', 'SRKK': 'A',
    'SUM': 'B', 'ELSA': 'B', 'NE': 'B', 'AMBEST': 'B', 'AMS': 'B',
    'EIPOWER': 'B', 'ISF': 'B', 'KEEMING': 'B', 'TEAMSTR': 'B', 'CBHB': 'B',
    'HEGROUP': 'B', 'MNHLDG': 'B', 'TMK': 'B', 'YEWLEE': 'B', 'HKB': 'B', 'UUE': 'B',
    'MMCS': 'C', 'GDGROUP': 'C', 'GOLDLI': 'C', 'HOCKSOON': 'C', 'OGX': 'C', 'SBS': 'C'
};

function calculateSmartScore(item) {
    let score = 0;
    const price = item.entryPrice || item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullbackVal = item.pullback !== null && item.pullback !== undefined ? item.pullback : 0;
    
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
    
    const grade = ipoMap[item.name.toUpperCase().trim()];
    if (grade === 'A') score += 3;
    else if (grade === 'B') score += 2;
    else if (grade === 'C') score += 1;
    
    if (pullbackVal <= 3.0 && isAboveSma50 && isAboveSma200) {
        score += 2;
    }
    
    const isFresh = item.ipoYear !== undefined && item.ipoYear >= 2025;
    const style = item.style || item.setupStyle || '';
    const setupName = item.setupName || '';
    if (isFresh && (style === 'EXPLOSIVE' || setupName.toUpperCase().includes('EXPLOSIVE'))) {
        score += 2;
    }
    
    return Math.min(15, score);
}

const trades = fullData.map(t => {
    let gain = t.finalGain;
    if (t.status === 'SL_HIT') gain = -3.00;
    const score = calculateSmartScore(t);
    return {
        ...t,
        gain,
        score,
        isWin: t.status.startsWith('PROFIT') || gain > 0
    };
});

const scoreGroups = {};
trades.forEach(t => {
    const s = t.score;
    if (!scoreGroups[s]) {
        scoreGroups[s] = { score: s, count: 0, wins: 0, totalReturn: 0 };
    }
    scoreGroups[s].count++;
    if (t.isWin) scoreGroups[s].wins++;
    scoreGroups[s].totalReturn += t.gain;
});

const report = Object.values(scoreGroups).map(g => {
    const winRate = (g.wins / g.count) * 100;
    const avgReturn = g.totalReturn / g.count;
    return {
        score: g.score,
        count: g.count,
        winRate: winRate.toFixed(1) + '%',
        totalReturn: g.totalReturn.toFixed(2) + '%',
        avgReturn: avgReturn.toFixed(2) + '%'
    };
}).sort((a, b) => b.score - a.score);

console.log("\n=== SMART SCORE EFFICIENCY ===");
console.table(report);
