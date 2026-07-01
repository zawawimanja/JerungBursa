const axios = require('axios');

async function inspectChb() {
    const symbol = '0291.KL'; // CHB
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    
    console.log(`🔍 Menarik data 1 tahun untuk ${symbol} dari Yahoo Finance...`);
    try {
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, { headers });
        if (!res.data || !res.data.chart || !res.data.chart.result) {
            console.error("❌ Tiada data ditemui.");
            return;
        }
        
        const result = res.data.chart.result[0];
        const timestamp = result.timestamp || [];
        const quote = result.indicators.quote[0];
        const close = quote.close || [];
        const low = quote.low || [];
        const high = quote.high || [];
        const open = quote.open || [];
        const volume = quote.volume || [];
        
        const data = [];
        for (let i = 0; i < timestamp.length; i++) {
            if (close[i] !== null && close[i] !== undefined) {
                const date = new Date(timestamp[i] * 1000).toISOString().split('T')[0];
                data.push({
                    date,
                    open: open[i],
                    high: high[i],
                    low: low[i],
                    close: close[i],
                    volume: volume[i]
                });
            }
        }
        
        console.log(`\n📊 Data 15 Hari Terakhir untuk CHB:`);
        console.log('='.repeat(80));
        console.log(`Tarikh     | Buka  | Tinggi | Rendah | Tutup | Perubahan % | Volum (M)   | Turnover (RM)`);
        console.log('='.repeat(80));
        
        const last15 = data.slice(-15);
        for (let i = 0; i < last15.length; i++) {
            const current = last15[i];
            const prev = i > 0 ? last15[i-1] : (data[data.length - 16] || current);
            const changePct = ((current.close - prev.close) / prev.close) * 100;
            const turnover = current.close * current.volume;
            
            console.log(
                `${current.date} | ` +
                `${current.open.toFixed(3)} | ` +
                `${current.high.toFixed(3)} | ` +
                `${current.low.toFixed(3)} | ` +
                `${current.close.toFixed(3)} | ` +
                `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%     | ` +
                `${(current.volume / 1e6).toFixed(2)}M        | ` +
                `RM ${(turnover / 1e6).toFixed(2)}M`
            );
        }
        
        // Calculate SMA50 and SMA200
        const closes = data.map(d => d.close);
        const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
        const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null;
        const currentPrice = closes[closes.length - 1];
        
        // Calculate 52W High
        let high52 = 0;
        data.forEach(d => { if (d.high > high52) high52 = d.high; });
        
        console.log('='.repeat(80));
        console.log(`💡 Rumusan Petunjuk Teknikal:`);
        console.log(`   - Harga Semasa: RM ${currentPrice.toFixed(3)}`);
        console.log(`   - SMA 50: RM ${sma50.toFixed(3)} (Kedudukan: ${currentPrice >= sma50 ? '🔥 Di atas SMA50 (Bullish)' : '🧊 Di bawah SMA50 (Downtrend)'})`);
        if (sma200) {
            console.log(`   - SMA 200: RM ${sma200.toFixed(3)} (Kedudukan: ${currentPrice >= sma200 ? '🔥 Di atas SMA200 (Long-term Bullish)' : '🧊 Di bawah SMA200 (Long-term Downtrend)'})`);
        }
        console.log(`   - 52W High: RM ${high52.toFixed(3)} (Pullback semasa: ${(((high52 - currentPrice)/high52)*100).toFixed(2)}%)`);
        
    } catch (e) {
        console.error("❌ Gagal:", e.message);
    }
}

inspectChb();
