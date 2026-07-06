const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

const getIpoDataPath = () => {
    const candidatePaths = [
        path.join(__dirname, '../../../ipo/data.json'),
        path.join(__dirname, '../../../ipohunterv2/data.json'),
        '/home/awi/Desktop/ipohunterv2/data.json',
        'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json'
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) return p;
    }
    return candidatePaths[0];
};
const IPO_DATA_PATH = getIpoDataPath();
const HISTORY_DIR = path.join(__dirname, '../history');
const MAPPINGS_PATH = path.join(__dirname, '../symbol_mappings.json');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchChart(symbol) {
    try {
        await sleep(40);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
        const res = await axios.get(url, { headers: HEADERS });
        if (!res.data || !res.data.chart || !res.data.chart.result || !res.data.chart.result[0]) return null;
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        const close = quote.close;
        const low = quote.low;
        const high = quote.high;
        const open = quote.open;

        const list = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (close[i] !== null && close[i] !== undefined && low[i] !== null && low[i] !== undefined && high[i] !== null && high[i] !== undefined) {
                const date = new Date((timestamps[i] + 8 * 3600) * 1000).toISOString().split('T')[0];
                list.push({ date, open: open[i], high: high[i], low: low[i], close: close[i] });
            }
        }
        return list;
    } catch (e) {
        return null;
    }
}

// Score with Grade A/B Premium IPO Booster
function calculateSmartScore(item, grade) {
    let score = 0;
    const price = item.price;
    const floorLow = item.floorLow || (price * 0.95);
    const distToFloor = ((price - floorLow) / floorLow) * 100;
    const pullback = item.pullback ?? 0;

    if (distToFloor <= 1.5) score += 4;
    else if (distToFloor <= 3.0) score += 2;
    else if (distToFloor <= 5.0) score += 1;

    if (item.touchCount >= 5) score += 3;
    else if (item.touchCount >= 3) score += 2;
    else if (item.touchCount >= 2) score += 1;

    if (item.isConsolidation) score += 2;

    if (pullback <= 5.0) score += 3;
    else if (pullback <= 12.0) score += 2;
    else if (pullback <= 25.0) score += 1;

    if (item.sma50 && price >= item.sma50) score += 2;
    if (item.sma200 && price >= item.sma200) score += 1;
    if (item.turnover >= 5000000) score += 1;

    // Premium Booster
    if (grade === 'A') score += 2;
    else if (grade === 'B') score += 1;

    return Math.min(15, score);
}

async function runComparison() {
    // 1. Load IPO Grades
    const ipoList = JSON.parse(fs.readFileSync(IPO_DATA_PATH, 'utf8'));
    const ipoMap = {};
    ipoList.forEach(item => {
        if (item.symbol) {
            ipoMap[item.symbol.toUpperCase().trim()] = item.predictedGrade || 'Unrated';
        }
    });

    // 2. Load mappings
    const mappings = JSON.parse(fs.readFileSync(MAPPINGS_PATH, 'utf8'));

    // 3. Load all history files
    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('data_') && f.endsWith('.json'))
        .sort();

    const dailyScans = [];
    const allUniqueNames = new Set();

    files.forEach(file => {
        const date = file.replace('data_', '').replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8'));
        const topVolume = data.topVolume || [];
        
        topVolume.forEach(item => {
            allUniqueNames.add(item.name);
        });

        dailyScans.push({ date, topVolume });
    });

    console.log(`Loaded ${dailyScans.length} daily history files. Unique stocks count: ${allUniqueNames.size}`);

    // Download charts
    console.log("Downloading charts...");
    const chartCache = {};
    for (const name of allUniqueNames) {
        const symbol = mappings[name];
        if (symbol && !chartCache[symbol]) {
            chartCache[symbol] = await fetchChart(symbol);
        }
    }
    console.log("Charts downloaded.\n");

    // Run Strategy A (Strict)
    console.log("=========================================");
    console.log("🛡️ STRATEGY A (STRICT FILTERING)");
    console.log("=========================================");
    await runStrategySimulation(dailyScans, ipoMap, mappings, chartCache, false);

    // Run Strategy B (Relaxed for Premium IPOs)
    console.log("\n=========================================");
    console.log("💎 STRATEGY B (RELAXED FOR PREMIUM IPOs)");
    console.log("=========================================");
    await runStrategySimulation(dailyScans, ipoMap, mappings, chartCache, true);
}

async function runStrategySimulation(dailyScans, ipoMap, mappings, chartCache, isStrategyB) {
    const portfolioTrades = [];

    dailyScans.forEach(scan => {
        const d = scan.date;
        let candidates = scan.topVolume.filter(r => {
            if (!r.high52) return false;
            
            // Liquidity filter
            const turnover = r.turnover || (r.price * r.volume);
            if (turnover < 750000) return false;

            // Price filter
            if (r.price < 0.25 || r.price > 4.00) return false;

            const grade = ipoMap[r.name.toUpperCase().trim()] || 'Non-IPO';
            const isPremiumIpo = grade === 'A' || grade === 'B';
            
            // Check pullback and downtrend limits
            const pullbackVal = r.pullback !== null && r.pullback !== undefined ? r.pullback : 0;
            const isAboveSma200 = r.sma200 ? r.price >= r.sma200 : false;
            const isSmaDowntrend = r.sma50 ? r.price < r.sma50 : false;

            if (isStrategyB && isPremiumIpo) {
                // Strategy B: Premium IPOs allowed up to 55% pullback, and exempt from SMA50 downtrend check
                if (pullbackVal > 55.0) return false;
            } else {
                // Strategy A (or non-premium): standard limits
                const maxPullbackLimit = isAboveSma200 ? 40.0 : 30.0;
                if (pullbackVal > maxPullbackLimit) return false;
                if (isSmaDowntrend) return false; // Avoid downtrend stocks
            }

            const score = calculateSmartScore(r, grade);
            return score >= 12; // VVIP score threshold
        });

        // Sort candidates by score, then turnover descending
        candidates.sort((a, b) => {
            const gradeA = ipoMap[a.name.toUpperCase().trim()] || 'Non-IPO';
            const gradeB = ipoMap[b.name.toUpperCase().trim()] || 'Non-IPO';
            const scoreDiff = calculateSmartScore(b, gradeB) - calculateSmartScore(a, gradeA);
            if (scoreDiff !== 0) return scoreDiff;
            
            const turnoverA = a.turnover || (a.price * a.volume);
            const turnoverB = b.turnover || (b.price * b.volume);
            return turnoverB - turnoverA;
        });

        // Select Top 3 daily
        const top3 = candidates.slice(0, 3);

        for (const c of top3) {
            const symbol = mappings[c.name];
            if (!symbol) continue;

            const chart = chartCache[symbol];
            if (!chart) continue;

            const startIdx = chart.findIndex(day => day.date === d);
            if (startIdx === -1) continue;

            const grade = ipoMap[c.name.toUpperCase().trim()] || 'Non-IPO';
            const isPremiumIpo = grade === 'A' || grade === 'B';

            let pnl = 0;
            let exitReason = '';
            const entryPrice = c.price;

            if (isPremiumIpo) {
                // Hold Lama with 10% Trailing Stop
                let peakPrice = entryPrice;
                let exitPrice = null;
                let slHit = false;

                for (let j = startIdx + 1; j < chart.length; j++) {
                    const day = chart[j];
                    if (day.high > peakPrice) {
                        peakPrice = day.high;
                    }

                    const trailingStop = peakPrice * 0.90;
                    if (day.low <= trailingStop) {
                        slHit = true;
                        exitPrice = trailingStop;
                        exitReason = 'Trailing Stop 📉';
                        break;
                    }
                }

                if (!slHit) {
                    const lastDay = chart[chart.length - 1];
                    exitPrice = lastDay.close;
                    exitReason = 'Holding (Unfinished Trend) 💎';
                }

                pnl = ((exitPrice - entryPrice) / entryPrice) * 100;
            } else {
                // Technique C standard swing: TP1 +10%, TP2 +20%, SL floor/10%, Time Stop 10 days
                const tp1 = entryPrice * 1.10;
                const tp2 = entryPrice * 1.20;
                const sl = Math.max(entryPrice * 0.90, c.floorLow * 0.97);

                let sellPrice1 = null;
                let sellPrice2 = null;
                let slHit = false;
                let exitIdx = Math.min(startIdx + 10, chart.length - 1);

                for (let j = startIdx + 1; j <= exitIdx; j++) {
                    const day = chart[j];
                    if (day.low <= sl) {
                        slHit = true;
                        exitIdx = j;
                        break;
                    }
                    if (!sellPrice1 && day.high >= tp1) {
                        sellPrice1 = tp1;
                    }
                    if (sellPrice1 && !sellPrice2 && day.high >= tp2) {
                        sellPrice2 = tp2;
                        exitIdx = j;
                        break;
                    }
                }

                if (slHit) {
                    pnl = ((sl - entryPrice) / entryPrice) * 100;
                    exitReason = 'Stop Loss 🔴';
                } else if (sellPrice1 && sellPrice2) {
                    pnl = 15.0;
                    exitReason = 'TP1 & TP2 Hit 💰';
                } else if (sellPrice1) {
                    const finalPrice = chart[exitIdx].close;
                    const pnl2 = ((finalPrice - entryPrice) / entryPrice) * 100;
                    pnl = (10.0 + pnl2) / 2;
                    exitReason = 'TP1 + Time Stop ⏱️';
                } else {
                    const finalPrice = chart[exitIdx].close;
                    pnl = ((finalPrice - entryPrice) / entryPrice) * 100;
                    exitReason = 'Time Stop ⏱️';
                }
            }

            portfolioTrades.push({
                name: c.name,
                date: d,
                grade,
                pnl,
                exitReason
            });
        }
    });

    let totalPnl = 0;
    let wins = 0;
    let slHits = 0;

    portfolioTrades.forEach(t => {
        totalPnl += t.pnl;
        if (t.pnl > 0) wins++;
        if (t.exitReason.includes('Stop Loss') || t.exitReason.includes('Trailing Stop')) slHits++;
        
        // Print individual trade results to show premium IPO plays
        if (t.grade === 'A' || t.grade === 'B') {
            console.log(`  [Trade] ${t.date} | ${t.name.padEnd(10)} | Grade: ${t.grade} | PnL: ${(t.pnl >= 0 ? '+' : '')}${t.pnl.toFixed(2)}% | Exit: ${t.exitReason}`);
        }
    });

    console.log(`-----------------------------------------`);
    console.log(`📊 PRESTASI PORTFOLIO KESELURUHAN:`);
    console.log(`  - Jumlah Transaksi  : ${portfolioTrades.length}`);
    console.log(`  - Win Rate          : ${portfolioTrades.length > 0 ? ((wins / portfolioTrades.length) * 100).toFixed(1) : 0}%`);
    console.log(`  - SL / TS Hit Rate  : ${portfolioTrades.length > 0 ? ((slHits / portfolioTrades.length) * 100).toFixed(1) : 0}%`);
    console.log(`  - Purata PnL        : +${portfolioTrades.length > 0 ? (totalPnl / portfolioTrades.length).toFixed(2) : 0}% per trade`);
    console.log(`  - Kumulatif PnL     : +${totalPnl.toFixed(2)}%`);
    console.log(`  - Anggaran Untung Modal (3-Slot): +${portfolioTrades.length > 0 ? (totalPnl / 3).toFixed(2) : 0}% sebulan 🚀`);
}

runComparison();
