const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, '../symbol_mappings.json'), 'utf8'));
const filePath = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(filePath, 'utf8');

const match = content.match(/const fullData = \[\s*([\s\S]*?)\s*\];/);
const rows = [];
match[1].split('\n').forEach(l => {
    if (!l.trim()) return;
    try {
        let cleaned = l.trim().replace(/,$/, '');
        rows.push(eval(`(${cleaned})`));
    } catch(e) {}
});

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

async function runSuperTrend1MonthBacktest() {
    console.log(`⏳ Memulakan backtest VVIP Super Trend (Hold Lama) untuk kaunter terpilih dari Jun-Julai...`);
    
    // Filter candidates meeting Super Trend rules: Score >= 10, Turnover >= 3.0M, Price 0.25 - 4.00
    const candidates = [];
    rows.forEach(r => {
        const score = calculateSmartScore(r);
        if (r.entryPrice >= 0.25 && r.entryPrice <= 4.00 && r.turnover >= 3000000 && score >= 10) {
            candidates.push(r);
        }
    });

    console.log(`Menjumpai ${candidates.length} isyarat kemasukan VVIP Super Trend.\n`);

    const trades = [];
    const cache = {};

    for (const c of candidates) {
        const symbol = mappings[c.name];
        if (!symbol) continue;

        if (!cache[symbol]) {
            cache[symbol] = await fetchChart(symbol);
        }

        const chart = cache[symbol];
        if (!chart) continue;

        const startIdx = chart.findIndex(d => d.date === c.date);
        if (startIdx === -1) continue;

        const entryPrice = c.entryPrice;
        let peakPrice = entryPrice;
        let exitPrice = null;
        let exitDate = null;
        let exitReason = 'HOLDING (Masing Belum Kena TS) 💎';
        let slHit = false;

        // Simulate holding from startIdx + 1 to the end of the chart
        for (let j = startIdx + 1; j < chart.length; j++) {
            const day = chart[j];
            if (day.high > peakPrice) {
                peakPrice = day.high;
            }

            const trailingStop = peakPrice * 0.90; // 10% Trailing Stop
            if (day.low <= trailingStop) {
                slHit = true;
                exitPrice = trailingStop;
                exitDate = day.date;
                exitReason = 'Trailing Stop Triggered 📉';
                break;
            }
        }

        // If not exited, evaluate at current closing price (July 3rd)
        if (!slHit) {
            const lastDay = chart[chart.length - 1];
            exitPrice = lastDay.close;
            exitDate = lastDay.date;
        }

        const pnl = ((exitPrice - entryPrice) / entryPrice) * 100;
        trades.push({
            name: c.name,
            entryDate: c.date,
            exitDate,
            entryPrice,
            exitPrice,
            peakPrice,
            pnl,
            exitReason
        });
    }

    // Sort by entry date
    trades.sort((a, b) => a.entryDate.localeCompare(b.entryDate));

    console.log(`========================================================================================`);
    console.log(`📅 HASIL BACKTEST VVIP SUPER TREND (PENGANGAN JUN - JULAI 2026):`);
    console.log(`========================================================================================`);
    console.log(`Saham      | Tarikh Masuk | Tarikh Jual  | Entry Price | Exit Price  | Peak Price  | PnL%    | Status`);
    console.log(`----------------------------------------------------------------------------------------`);
    
    let wins = 0;
    let pnlSum = 0;

    trades.forEach(t => {
        pnlSum += t.pnl;
        if (t.pnl > 0) wins++;
        const pnlStr = (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) + '%';
        console.log(`${t.name.padEnd(10)} | ${t.entryDate}   | ${t.exitDate}   | RM ${t.entryPrice.toFixed(3).padEnd(8)} | RM ${t.exitPrice.toFixed(3).padEnd(8)} | RM ${t.peakPrice.toFixed(3).padEnd(8)} | ${pnlStr.padStart(7)} | ${t.exitReason}`);
    });

    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`📊 RUMUSAN PRESTASI VVIP SUPER TREND:`);
    console.log(`  - Jumlah Transaksi  : ${trades.length}`);
    console.log(`  - Win Rate          : ${((wins / trades.length) * 100).toFixed(1)}%`);
    console.log(`  - Purata PnL        : +${(pnlSum / trades.length).toFixed(2)}% per trade`);
    console.log(`  - Kumulatif PnL     : +${pnlSum.toFixed(2)}%`);
    console.log(`========================================================================================\n`);
}

runSuperTrend1MonthBacktest();
