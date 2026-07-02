const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backtest.html');

if (!fs.existsSync(filePath)) {
    console.error("❌ backtest.html not found!");
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace the paragraph text
const oldParagraph = `Berdasarkan data empirikal pasaran sebenar (22 Jun - Kini), strategi paling cemerlang dan selamat untuk mengelak kerugian Stop Loss adalah <strong>membeli hanya 1 kaunter EXPLOSIVE teratas + 1 kaunter STAIRCASE teratas sehari</strong> yang disokong oleh volum <em>Smart Money</em> tinggi (Turnover ≥ RM 5 Juta).`;
const newParagraph = `Berdasarkan data empirikal pasaran sebenar (22 Jun - Kini), strategi paling cemerlang dan selamat untuk mengelak kerugian Stop Loss adalah <strong>membeli Top 3 kaunter EXPLOSIVE teratas + Top 3 kaunter STAIRCASE teratas sehari</strong> yang disokong oleh volum <em>Smart Money</em> tinggi (Turnover ≥ RM 1.5 Juta) menggunakan Smart Score.`;

if (content.includes(oldParagraph)) {
    content = content.replace(oldParagraph, newParagraph);
    console.log("✅ Paragraph description updated successfully.");
} else {
    console.warn("⚠️ Warning: Old paragraph text not found.");
}

// 2. Replace the stats logic
const oldStatsLogic = `            // Compute Option C Hybrid Premium stats dynamically
            const hybridTrades = [];
            const datesList = [...new Set(fullData.map(r => r.date))].sort();
            
            datesList.forEach(d => {
                const dayRows = fullData.filter(r => r.date === d);
                
                // Separate by style and filter turnover >= 5M
                const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && (r.turnover === undefined || r.turnover >= 5000000));
                const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && (r.turnover === undefined || r.turnover >= 5000000));
                
                // Sort by turnover descending
                exps.sort((a, b) => (b.turnover || 0) - (a.turnover || 0));
                stairs.sort((a, b) => (b.turnover || 0) - (a.turnover || 0));
                
                if (exps[0]) hybridTrades.push(exps[0]);
                if (stairs[0]) hybridTrades.push(stairs[0]);
            });`;

const newStatsLogic = `            // Calculate dynamic Smart Score for ranking
            function calculateSmartScore(item) {
                let score = 0;
                const price = item.entryPrice || item.price;
                const floorLow = item.floorLow || (price * 0.95);
                const distToFloor = ((price - floorLow) / floorLow) * 100;
                const pullbackVal = item.pullback !== null && item.pullback !== undefined ? item.pullback : 0;
                const pct = item.changePct !== undefined ? item.changePct : (item.change || 0);
                
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
                
                // 6. High volume spike confirmation (Liquidity score booster)
                if (item.turnover >= 5000000) score += 1;
                
                return score;
            }

            // Compute Option C Hybrid Premium stats dynamically
            const hybridTrades = [];
            const datesList = [...new Set(fullData.map(r => r.date))].sort();
            
            datesList.forEach(d => {
                const dayRows = fullData.filter(r => r.date === d);
                
                // Separate by style and filter turnover >= 1.5M
                const exps = dayRows.filter(r => r.style === 'EXPLOSIVE' && (r.turnover === undefined || r.turnover >= 1500000));
                const stairs = dayRows.filter(r => r.style === 'STAIRCASE' && (r.turnover === undefined || r.turnover >= 1500000));
                
                // Sort by smart score descending, then by turnover descending
                const sortFn = (a, b) => {
                    const scoreA = calculateSmartScore(a);
                    const scoreB = calculateSmartScore(b);
                    if (scoreB !== scoreA) return scoreB - scoreA;
                    return (b.turnover || 0) - (a.turnover || 0);
                };
                exps.sort(sortFn);
                stairs.sort(sortFn);
                
                const topExps = exps.slice(0, 3);
                const topStairs = stairs.slice(0, 3);
                
                topExps.forEach(t => hybridTrades.push(t));
                topStairs.forEach(t => hybridTrades.push(t));
            });`;

if (content.includes(oldStatsLogic)) {
    content = content.replace(oldStatsLogic, newStatsLogic);
    console.log("✅ Stats logic updated successfully.");
} else {
    // Normalise newlines in content and search string to check
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normalizedOld = oldStatsLogic.replace(/\r\n/g, '\n');
    if (normalizedContent.includes(normalizedOld)) {
        content = normalizedContent.replace(normalizedOld, newStatsLogic);
        console.log("✅ Stats logic updated successfully (after newline normalization).");
    } else {
        console.error("❌ Error: Stats logic block not found in backtest.html.");
        process.exit(1);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("✅ backtest.html updated successfully!");
