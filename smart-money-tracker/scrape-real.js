const fs = require('fs');
const path = require('path');

(async () => {
    console.log("🚀 Memulakan scraper tanpa Puppeteer...");
    
    const vipList = [
        { name: 'GREATEC', symbol: '0208.KL' },
        { name: 'UNISEM', symbol: '5005.KL' },
        { name: 'PENTA', symbol: '7160.KL' },
        { name: 'MI', symbol: '5286.KL' },
        { name: 'VSTECS', symbol: '5162.KL' },
        { name: 'KGB', symbol: '0151.KL' },
        { name: 'NATGATE', symbol: '0270.KL' },
        { name: 'FRONTKN', symbol: '0128.KL' },
        { name: 'INARI', symbol: '0166.KL' },
        { name: 'MPI', symbol: '3867.KL' },
        { name: 'UWC', symbol: '5292.KL' },
        { name: 'GTRONIC', symbol: '7022.KL' },
        { name: 'MYEG', symbol: '0138.KL' },
        { name: 'MAYBANK', symbol: '1155.KL' },
        { name: 'CIMB', symbol: '1023.KL' },
        { name: 'TENAGA', symbol: '5347.KL' },
        { name: 'GAMUDA', symbol: '5398.KL' },
        { name: 'SUNWAY', symbol: '5211.KL' },
        { name: 'IJM', symbol: '3336.KL' }
    ];

    console.log(`📊 Menganalisis Formula Smart Money (Turnover + Momentum)...`);
    const results = [];

    for (let t of vipList) {
        try {
            // Use Yahoo Finance API directly
            const response = await fetch(
                `https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}?interval=1d`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            );

            if (!response.ok) {
                console.log(`⚠️ API error untuk ${t.name}: ${response.status}`);
                continue;
            }

            const data = await response.json();

            if (data && data.chart && data.chart.result && data.chart.result.length > 0) {
                const quote = data.chart.result[0].meta;
                const price = quote.regularMarketPrice;
                const prevClose = quote.chartPreviousClose;
                const change = price - prevClose;
                const changePercent = (change / prevClose) * 100;
                const volume = quote.regularMarketVolume || 0;
                const turnover = price * volume;

                let signal = "avoid";
                let reason = "Kaunter Lemau / Sikat";

                if (changePercent > 0 && turnover > 3000000) {
                    signal = "buy";
                    if (changePercent <= 4.0) {
                        if (price >= 1.50) {
                            reason = "🔥 GOLDEN ENTRY (Stabil - Gergasi / Peram Santai)";
                        } else {
                            reason = "🔥 GOLDEN ENTRY (Lincah - Midcap / Laju & Volatile)";
                        }
                    } else if (changePercent > 4.0 && changePercent <= 8.0) {
                        reason = "⚡ Momentum Kuat (Sesuai Intraday, Berisiko Swing)";
                    } else {
                        reason = "🚨 OVERBOUGHT (Dah Terbang, Awas Kena Dump)";
                    }
                } else if (changePercent <= 0 && turnover > 5000000) {
                    reason = "⚠️ Jerung Buang Barang / Markup";
                }

                let dynamicCategory = "Intraday / Momentum";
                if (price >= 1.00) {
                    dynamicCategory = "Swing / Mid-Cap";
                } else if (price <= 0.30) {
                    dynamicCategory = "Penny / Spekulatif";
                }

                results.push({
                    name: t.name,
                    sector: "Auto-Scanned",
                    category: dynamicCategory,
                    price: price,
                    change: changePercent,
                    turnover: turnover,
                    volume: volume,
                    signal: signal,
                    reason: reason
                });
                console.log(`✅ ${t.name} disemak: Harga RM ${price.toFixed(3)} | Turnover: ${(turnover / 1000000).toFixed(2)}M`);
            } else {
                console.log(`❌ Gagal dapatkan harga Yahoo untuk ${t.name}`);
            }
        } catch (e) {
            console.log(`❌ Ralat pada ${t.name}: ${e.message}`);
        }
    }

    // Auto-susun ranking ikut Turnover tertinggi
    results.sort((a, b) => b.turnover - a.turnover);

    const outputPath = path.join(__dirname, 'live_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    // Simpan sejarah
    const historyDir = path.join(__dirname, 'history');
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir);
    }
    const today = new Date().toISOString().split('T')[0];
    const historyPath = path.join(historyDir, `data_${today}.json`);
    fs.writeFileSync(historyPath, JSON.stringify(results, null, 2));

    console.log(`\n🎉 Selesai scan seluruh pasaran! Disimpan ke ${outputPath}`);
    console.log(`📂 Salinan sejarah (Proof) disimpan ke ${historyPath}`);
})();
