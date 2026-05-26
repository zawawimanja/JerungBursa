const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
    console.log("🚀 Memulakan enjin Puppeteer Stealth...");
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    // Jangan hardcode - biar puppeteer cari sendiri
    // Dia akan auto-cari dari cache atau installed browsers

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // ... rest of code

    console.log("🌐 Sedut senarai Top Active & Top Gainers dari pasaran (Auto-Scan)...");

    // --- VIP HYBRID LIST (Sentiasa Pantau Kumpulan Jerung & Tech) ---
    let allTickersMap = new Map();

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

    vipList.forEach(t => allTickersMap.set(t.symbol, t));

    // Auto-scrape Top Active dari Bursa Malaysia untuk tambah kaunter momentum baru
    const urls = [
        'https://www.bursamalaysia.com/market_information/equities_prices?mode=top_active',
        'https://www.bursamalaysia.com/market_information/equities_prices?mode=top_gainers'
    ];

    for (let url of urls) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            const data = await page.evaluate(() => {
                const rows = document.querySelectorAll('table tbody tr');
                let results = [];
                rows.forEach(r => {
                    const nameEl = r.querySelector('td:nth-child(2)');
                    const codeEl = r.querySelector('td:nth-child(3)');
                    if (nameEl && codeEl) {
                        let code = codeEl.textContent.trim();
                        // Hanya ambil saham sebenar (kod 4 digit seperti 0208), buang warrant/structured warrant
                        if (code.match(/^\d{4}$/)) {
                            results.push({
                                name: nameEl.textContent.trim().split(' ')[0].replace(/\[S\]/g, ''),
                                symbol: code + '.KL'
                            });
                        }
                    }
                });
                return results;
            });

            // Masukkan dalam map untuk elak nama bersilang/duplicate
            data.forEach(t => allTickersMap.set(t.symbol, t));
        } catch (e) {
            console.log("⚠️ Gagal loading senarai dari Bursa:", url);
        }
    }

    const TICKERS = Array.from(allTickersMap.values());
    console.log(`✅ Berjaya kumpul ${TICKERS.length} kaunter tulen dari senarai Top Pasaran hari ini!`);

    if (TICKERS.length === 0) {
        console.log("❌ Tiada kaunter ditemui. Sistem mungkin block, atau pasaran tutup.");
        await browser.close();
        return;
    }

    console.log("🌐 Mendapatkan 'pass' keselamatan dari Yahoo Finance...");
    try {
        await page.goto('https://finance.yahoo.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e) {
        console.log("⚠️ Yahoo Finance loading slow, continuing anyway...");
    }

    console.log("📊 Menganalisis Formula Smart Money (Turnover + Momentum)...");
    const results = [];

    for (let t of TICKERS) {
        try {
            const data = await page.evaluate(async (sym) => {
                const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d`);
                if (!res.ok) return null;
                return await res.json();
            }, t.symbol);

            if (data && data.chart && data.chart.result) {
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
                    sector: "Auto-Scanned", // Kategori auto
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

    // Auto-susun ranking ikut Turnover tertinggi (Smart Money)
    results.sort((a, b) => b.turnover - a.turnover);

    const outputPath = path.join(__dirname, 'live_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    // --- SIMPAN SEJARAH (HISTORY) UNTUK BUKTI PRESTASI ---
    const historyDir = path.join(__dirname, 'history');
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir);
    }
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const historyPath = path.join(historyDir, `data_${today}.json`);
    fs.writeFileSync(historyPath, JSON.stringify(results, null, 2));

    console.log(`\n🎉 Selesai scan seluruh pasaran! Disimpan ke ${outputPath}`);
    console.log(`📂 Salinan sejarah (Proof) disimpan ke ${historyPath}`);

    await browser.close();
})();
