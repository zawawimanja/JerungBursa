const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

// Target momentum swing stocks to test
const TEST_STOCKS = [
    { name: 'YEWLEE', symbol: '0248.KL' },
    { name: 'SFPTECH', symbol: '0251.KL' },
    { name: 'MNHLDG', symbol: '0245.KL' },
    { name: 'GREATEC', symbol: '0208.KL' },
    { name: 'SCGBHD', symbol: '0225.KL' },
    { name: 'AMBEST', symbol: '0391.KL' },
    { name: 'JPG', symbol: '5323.KL' },
    { name: 'EIPOWER', symbol: '0453.KL' },
    { name: 'AMS', symbol: '0399.KL' },
    { name: 'NE', symbol: '0325.KL' }
];

function getLocalDate(ts) {
    const date = new Date((ts + 8 * 3600) * 1000);
    return date.toISOString().split('T')[0];
}

async function fetchHistoricalData(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
        const res = await axios.get(url, { headers: HEADERS });
        if (!res.data || !res.data.chart || !res.data.chart.result || !res.data.chart.result[0]) {
            return null;
        }
        const result = res.data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        const close = quote.close;
        const low = quote.low;
        const high = quote.high;
        const open = quote.open;
        const volume = quote.volume;

        const list = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (close[i] !== null && close[i] !== undefined &&
                low[i] !== null && low[i] !== undefined &&
                high[i] !== null && high[i] !== undefined &&
                open[i] !== null && open[i] !== undefined &&
                volume[i] !== null && volume[i] !== undefined) {
                list.push({
                    date: getLocalDate(timestamps[i]),
                    open: open[i],
                    high: high[i],
                    low: low[i],
                    close: close[i],
                    volume: volume[i]
                });
            }
        }
        return list;
    } catch (e) {
        console.error(`Gagal muat turun data untuk ${symbol}: ${e.message}`);
        return null;
    }
}

function runBacktest() {
    console.log(`🚀 MEMULAKAN SIMULASI SEJARAH 1 TAHUN (JULAI 2025 - JULAI 2026)`);
    console.log(`==================================================================`);

    Promise.all(TEST_STOCKS.map(async (stock) => {
        const data = await fetchHistoricalData(stock.symbol);
        if (!data || data.length < 200) {
            console.log(`⚠️ Kaunter ${stock.name} tidak mempunyai cukup data.`);
            return { name: stock.name, techCTrades: [], superTrendTrades: [] };
        }

        const techCTrades = [];
        const superTrendTrades = [];

        // Loop through history starting from index 50 (warmup) to allow SMA50 calculation
        for (let i = 50; i < data.length - 15; i++) {
            const today = data[i];
            const yesterday = data[i - 1];

            // 1. Calculate indicators
            const closes50 = data.slice(i - 49, i + 1).map(d => d.close);
            const sma50 = closes50.reduce((a, b) => a + b, 0) / 50;

            const closes200 = i >= 200 ? data.slice(i - 199, i + 1).map(d => d.close) : closes50;
            const sma200 = closes200.reduce((a, b) => a + b, 0) / closes200.length;

            const high52 = Math.max(...data.slice(Math.max(0, i - 250), i + 1).map(d => d.high));
            const pullback = ((high52 - today.close) / high52) * 100;

            // support floor (lowest low of last 10 days)
            const lows10 = data.slice(i - 9, i + 1).map(d => d.low);
            const floorLow = Math.min(...lows10);
            const distToFloor = ((today.close - floorLow) / floorLow) * 100;

            let touchCount = 0;
            data.slice(i - 9, i + 1).forEach(d => {
                if (((d.low - floorLow) / floorLow) * 100 <= 2.0) touchCount++;
            });

            // tightness
            const closes4 = data.slice(i - 3, i + 1).map(d => d.close);
            const maxC = Math.max(...closes4);
            const minC = Math.min(...closes4);
            const closeTightness = ((maxC - minC) / minC) * 100;
            const isConsolidation = closeTightness <= 5.0;

            const turnover = today.volume * today.close;

            // Calculate Smart Score
            let score = 0;
            if (distToFloor <= 1.5) score += 4;
            else if (distToFloor <= 3.0) score += 2;
            else if (distToFloor <= 5.0) score += 1;

            if (touchCount >= 5) score += 3;
            else if (touchCount >= 3) score += 2;
            else if (touchCount >= 2) score += 1;

            if (isConsolidation) score += 2;

            if (pullback <= 5.0) score += 3;
            else if (pullback <= 12.0) score += 2;
            else if (pullback <= 25.0) score += 1;

            if (today.close >= sma50) score += 2;
            if (today.close >= sma200) score += 1;
            if (turnover >= 5000000) score += 1;

            const isBouncing = today.close > yesterday.close;

            // ==========================================
            // SIGNAL CHECK: Technique C (Swing Play)
            // ==========================================
            if (today.close >= 0.25 && today.close <= 4.00 &&
                turnover >= 750000 &&
                score >= 8 &&
                isBouncing &&
                pullback <= 30.0) {

                // Ensure we don't overlapping trade for the same stock
                const hasOverlap = techCTrades.some(t => t.exitIndex >= i);
                if (!hasOverlap) {
                    // Simulate holding
                    const entryPrice = today.close;
                    const tp1 = entryPrice * 1.10;
                    const tp2 = entryPrice * 1.20;
                    const sl = Math.max(entryPrice * 0.90, floorLow * 0.97);

                    let exitIndex = i + 10;
                    let sellPrice1 = null;
                    let sellPrice2 = null;
                    let slHit = false;
                    let timeStop = false;

                    for (let j = i + 1; j <= Math.min(i + 10, data.length - 1); j++) {
                        const day = data[j];
                        
                        // Check SL
                        if (day.low <= sl) {
                            slHit = true;
                            exitIndex = j;
                            break;
                        }

                        // Check TP1
                        if (!sellPrice1 && day.high >= tp1) {
                            sellPrice1 = tp1;
                        }

                        // Check TP2
                        if (sellPrice1 && !sellPrice2 && day.high >= tp2) {
                            sellPrice2 = tp2;
                            exitIndex = j;
                            break;
                        }
                    }

                    let pnl = 0;
                    let exitReason = '';
                    if (slHit) {
                        pnl = ((sl - entryPrice) / entryPrice) * 100;
                        exitReason = 'Stop Loss 🔴';
                    } else if (sellPrice1 && sellPrice2) {
                        pnl = 15.0; // average of +10% and +20%
                        exitReason = 'TP1 & TP2 Hit 💰';
                    } else if (sellPrice1) {
                        const finalPrice = data[Math.min(i + 10, data.length - 1)].close;
                        const pnl2 = ((finalPrice - entryPrice) / entryPrice) * 100;
                        pnl = (10.0 + pnl2) / 2;
                        pnl = Math.max(-10.0, pnl);
                        exitReason = 'TP1 Hit + Time Stop ⏱️';
                    } else {
                        const finalPrice = data[Math.min(i + 10, data.length - 1)].close;
                        pnl = ((finalPrice - entryPrice) / entryPrice) * 100;
                        pnl = Math.max(-10.0, pnl);
                        exitReason = 'Time Stop ⏱️';
                    }

                    techCTrades.push({
                        entryDate: today.date,
                        exitDate: data[Math.min(exitIndex, data.length - 1)].date,
                        entryPrice,
                        pnl,
                        exitReason,
                        exitIndex
                    });
                }
            }

            // ==========================================
            // SIGNAL CHECK: VVIP Super Trend (Hold Lama)
            // ==========================================
            if (today.close >= 0.25 && today.close <= 4.00 &&
                turnover >= 3000000 && // lowered turnover slightly to catch more setups in this list
                score >= 10 &&
                isBouncing &&
                pullback <= 30.0) {

                const hasOverlap = superTrendTrades.some(t => t.exitIndex >= i);
                if (!hasOverlap) {
                    const entryPrice = today.close;
                    let peakPrice = entryPrice;
                    let exitIndex = i + 90;
                    let slHit = false;

                    for (let j = i + 1; j <= Math.min(i + 90, data.length - 1); j++) {
                        const day = data[j];
                        if (day.high > peakPrice) {
                            peakPrice = day.high;
                        }

                        const trailingStop = peakPrice * 0.90; // 10% Trailing Stop
                        if (day.low <= trailingStop) {
                            slHit = true;
                            exitIndex = j;
                            break;
                        }
                    }

                    let pnl = 0;
                    let exitReason = '';
                    if (slHit) {
                        const trailingStop = peakPrice * 0.90;
                        pnl = ((trailingStop - entryPrice) / entryPrice) * 100;
                        exitReason = 'Trailing Stop 📉';
                    } else {
                        const finalPrice = data[Math.min(i + 90, data.length - 1)].close;
                        pnl = ((finalPrice - entryPrice) / entryPrice) * 100;
                        exitReason = '90-Day Time Stop ⏱️';
                    }

                    superTrendTrades.push({
                        entryDate: today.date,
                        exitDate: data[Math.min(exitIndex, data.length - 1)].date,
                        entryPrice,
                        pnl,
                        exitReason,
                        exitIndex
                    });
                }
            }
        }

        return { name: stock.name, techCTrades, superTrendTrades };
    })).then((results) => {
        let totalTechCTrades = 0;
        let winTechC = 0;
        let totalTechCPnl = 0;

        let totalSTTrades = 0;
        let winST = 0;
        let totalSTPnl = 0;

        results.forEach(res => {
            console.log(`\n==================================================================`);
            console.log(`📈 PRESTASI SEJARAH 1 TAHUN UNTUK SAHAM: ${res.name}`);
            console.log(`==================================================================`);
            
            console.log(`\n1. TEKNIK C (SWING 7-10 HARI):`);
            console.log(`------------------------------------------------------------------`);
            if (res.techCTrades.length === 0) {
                console.log(`Tiada trade ditemui.`);
            } else {
                console.log(`Tarikh Masuk | Tarikh Keluar | Entry Price | PnL%    | Sebab Exit`);
                console.log(`------------------------------------------------------------------`);
                res.techCTrades.forEach(t => {
                    totalTechCTrades++;
                    totalTechCPnl += t.pnl;
                    if (t.pnl > 0) winTechC++;
                    console.log(`${t.entryDate}   | ${t.exitDate}    | RM ${t.entryPrice.toFixed(3).padEnd(8)} | ${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2).padStart(6)}% | ${t.exitReason}`);
                });
            }

            console.log(`\n2. VVIP SUPER TREND (HOLD 1-3 BULAN):`);
            console.log(`------------------------------------------------------------------`);
            if (res.superTrendTrades.length === 0) {
                console.log(`Tiada trade ditemui.`);
            } else {
                console.log(`Tarikh Masuk | Tarikh Keluar | Entry Price | PnL%    | Sebab Exit`);
                console.log(`------------------------------------------------------------------`);
                res.superTrendTrades.forEach(t => {
                    totalSTTrades++;
                    totalSTPnl += t.pnl;
                    if (t.pnl > 0) winST++;
                    console.log(`${t.entryDate}   | ${t.exitDate}    | RM ${t.entryPrice.toFixed(3).padEnd(8)} | ${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2).padStart(6)}% | ${t.exitReason}`);
                });
            }
        });

        console.log(`\n==================================================================`);
        console.log(`📊 RUMUSAN PRESTASI AGREGAT PORTFOLIO (1 TAHUN):`);
        console.log(`==================================================================`);
        
        console.log(`Teknik C (Swing Play):`);
        console.log(`  - Jumlah Trades : ${totalTechCTrades}`);
        console.log(`  - Win Rate      : ${((winTechC / totalTechCTrades) * 100).toFixed(1)}%`);
        console.log(`  - Purata PnL    : +${(totalTechCPnl / totalTechCTrades).toFixed(2)}% per trade`);
        console.log(`  - Kumulatif PnL : +${totalTechCPnl.toFixed(2)}%`);
        console.log(`------------------------------------------------------------------`);
        console.log(`VVIP Super Trend (Position Play):`);
        console.log(`  - Jumlah Trades : ${totalSTTrades}`);
        console.log(`  - Win Rate      : ${((winST / totalSTTrades) * 100).toFixed(1)}%`);
        console.log(`  - Purata PnL    : +${(totalSTPnl / totalSTTrades).toFixed(2)}% per trade`);
        console.log(`  - Kumulatif PnL : +${totalSTPnl.toFixed(2)}%`);
        console.log(`==================================================================\n`);
    });
}

runBacktest();
