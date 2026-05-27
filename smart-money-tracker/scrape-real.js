const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

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
            const code = t.symbol.split('.')[0];
            const response = await axios.get(`https://www.klsescreener.com/v2/stocks/view/${code}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const $ = cheerio.load(response.data);
            
            const priceStr = $('#price').text().trim();
            const volumeStr = $('#volume').text().trim().replace(/,/g, '');
            const priceDiffStr = $('#priceDiff').text().trim();

            const price = parseFloat(priceStr);
            const volume = parseInt(volumeStr, 10) || 0;
            
            let changePercent = 0;
            const match = priceDiffStr.match(/\((.*?)\%\)/);
            if (match && match[1]) {
                changePercent = parseFloat(match[1].replace('+', ''));
            }
            const turnover = price * volume;

            if (isNaN(price)) {
                console.log(`❌ Gagal dapatkan harga untuk ${t.name}`);
                continue;
            }

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
                    reason = "⚡ Momentum Kuat (Harga Sedang Mencanak Naik Laju)";
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
