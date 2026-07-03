const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

const IPO_DATA_PATH = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const BACKTEST_HTML_PATH = path.join(__dirname, '../backtest.html');
const MAPPINGS_PATH = path.join(__dirname, '../symbol_mappings.json');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchChart(symbol) {
    try {
        await sleep(50);
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

function calculateSmartScore(item) {
    let score = 0;
    const price = item.entryPrice || item.price;
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

    return score;
}

async function runHybridBacktest() {
    console.log("========================================================================================");
    console.log("🔬 SIMULASI HIBRID: GABUNGAN TEKNIKAL JERUNGBURSA & GRED IPO PROJEK");
    console.log("========================================================================================");

    // 1. Load IPO Grades database
    if (!fs.existsSync(IPO_DATA_PATH)) {
        console.error("❌ IPO data.json tidak ditemui!");
        return;
    }
    const ipoList = JSON.parse(fs.readFileSync(IPO_DATA_PATH, 'utf8'));
    const ipoMap = {};
    ipoList.forEach(item => {
        if (item.symbol) {
            ipoMap[item.symbol.toUpperCase().trim()] = {
                grade: item.predictedGrade || 'Unrated',
                sector: (item.sector || '').toLowerCase()
            };
        }
    });
    console.log(`✅ Berjaya memuatkan ${Object.keys(ipoMap).length} kaunter gred IPO dari projek sebelah.`);

    // 2. Load symbol mappings
    const mappings = JSON.parse(fs.readFileSync(MAPPINGS_PATH, 'utf8'));

    // 3. Load candidate rows from backtest.html
    const content = fs.readFileSync(BACKTEST_HTML_PATH, 'utf8');
    const match = content.match(/const fullData = \[\s*([\s\S]*?)\s*\];/);
    const rows = [];
    match[1].split('\n').forEach(l => {
        if (!l.trim()) return;
        try {
            let cleaned = l.trim().replace(/,$/, '');
            rows.push(eval(`(${cleaned})`));
        } catch(e) {}
    });

    // Filter Top 3 candidates per day to represent the real diversified portfolio
    const datesList = [...new Set(rows.map(r => r.date))].sort();
    const portfolioTrades = [];

    console.log(`⏳ Memuat turun carta data Yahoo Finance & simulasi trade untuk tempoh Jun - Julai...`);

    const chartCache = {};

    for (const d of datesList) {
        let candidates = rows.filter(r => r.date === d && r.turnover >= 750000 && calculateSmartScore(r) >= 8);
        
        candidates.sort((a, b) => {
            const scoreDiff = calculateSmartScore(b) - calculateSmartScore(a);
            if (scoreDiff !== 0) return scoreDiff;
            return b.turnover - a.turnover;
        });

        // Select Top 3 for the day
        const top3 = candidates.slice(0, 3);

        for (const c of top3) {
            const symbol = mappings[c.name];
            if (!symbol) continue;

            if (!chartCache[symbol]) {
                chartCache[symbol] = await fetchChart(symbol);
            }

            const chart = chartCache[symbol];
            if (!chart) continue;

            const startIdx = chart.findIndex(day => day.date === c.date);
            if (startIdx === -1) continue;

            // Cross-reference with IPO Grades
            const ipoInfo = ipoMap[c.name.toUpperCase().trim()];
            const isPremiumIpo = ipoInfo && 
                (ipoInfo.grade === 'A' || ipoInfo.grade === 'B') && 
                (ipoInfo.sector.includes('tech') || ipoInfo.sector.includes('semicon') || ipoInfo.sector.includes('energy') || ipoInfo.sector.includes('solar'));

            const strategyUsed = isPremiumIpo ? 'VVIP SUPER TREND 💎' : 'TEKNIK C SWING 🛡️';
            
            let pnl = 0;
            let exitReason = '';
            const entryPrice = c.entryPrice;

            if (isPremiumIpo) {
                // Run VVIP Super Trend simulation (Hold Lama with 10% Trailing Stop)
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
                // Run standard Technique C swing simulation (TP1 +10%, TP2 +20%, SL floor/10%, Time Stop 10 days)
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
                date: c.date,
                strategy: strategyUsed,
                grade: ipoInfo ? ipoInfo.grade : 'Non-IPO',
                entryPrice,
                pnl,
                exitReason
            });
        }
    }

    // Sort portfolio trades by date
    portfolioTrades.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`\n========================================================================================`);
    console.log(`📋 LOG TRANSAKSI PORTFOLIO HIBRID (GRED IPO + TEKNIKAL):`);
    console.log(`========================================================================================`);
    console.log(`Tarikh     | Saham      | Jenis Saham | Strategi Dijalan     | PnL%    | Sebab Exit`);
    console.log(`----------------------------------------------------------------------------------------`);
    
    let totalPnl = 0;
    let wins = 0;
    let slHits = 0;

    portfolioTrades.forEach(t => {
        totalPnl += t.pnl;
        if (t.pnl > 0) wins++;
        if (t.exitReason.includes('Stop Loss') || t.exitReason.includes('Trailing Stop')) slHits++;
        const pnlStr = (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) + '%';
        console.log(`${t.date} | ${t.name.padEnd(10)} | ${t.grade.padEnd(11)} | ${t.strategy.padEnd(21)} | ${pnlStr.padStart(7)} | ${t.exitReason}`);
    });

    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`📊 PRESTASI PORTFOLIO HIBRID KESELURUHAN (TOP 3 SAHAJA):`);
    console.log(`  - Jumlah Transaksi  : ${portfolioTrades.length}`);
    console.log(`  - Win Rate          : ${((wins / portfolioTrades.length) * 100).toFixed(1)}%`);
    console.log(`  - SL / TS Hit Rate  : ${((slHits / portfolioTrades.length) * 100).toFixed(1)}%`);
    console.log(`  - Purata PnL        : +${(totalPnl / portfolioTrades.length).toFixed(2)}% per trade`);
    console.log(`  - Kumulatif PnL     : +${totalPnl.toFixed(2)}%`);
    console.log(`  - Anggaran Untung Modal (3-Slot): +${(totalPnl / 3).toFixed(2)}% sebulan 🚀`);
    console.log(`========================================================================================\n`);
}

runHybridBacktest();
