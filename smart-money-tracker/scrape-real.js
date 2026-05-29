const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.join(__dirname, 'live_data.json');

async function scrapeDynamicData() {
    console.log("🚀 Memulakan scraper dinamik menggunakan Puppeteer...");
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
    } catch (err) {
        console.error("❌ Ralat: Gagal melancarkan Chrome. Sila jalankan 'npx puppeteer browsers install chrome' jika anda mencuba ini pada komputer tempatan.");
        process.exit(1);
    }
    
    try {
        const page = await browser.newPage();
        
        // Pergi ke halaman Top Volume KLSE Screener
        console.log("📥 Menarik data 100 kaunter Top Volume...");
        await page.goto('https://www.klsescreener.com/v2/screener/top_volume', {waitUntil: 'domcontentloaded', timeout: 60000});
        
        const rawCounters = await page.evaluate(() => {
            let results = [];
            const rows = document.querySelectorAll('tr.list-group-item');
            rows.forEach(r => {
                const nameEl = r.querySelector('a[title]');
                const codeEl = r.querySelector('.code');
                const priceEl = r.querySelector('td:nth-child(3)'); // Typically price is the 3rd or 4th column
                const changeEl = r.querySelector('td:nth-child(4)'); // Change column
                const volumeEl = r.querySelector('td:nth-child(5)'); // Volume column
                
                if (nameEl && codeEl && priceEl && volumeEl) {
                    let name = nameEl.textContent.trim();
                    let code = codeEl.textContent.trim();
                    
                    // Cleanup price
                    let priceText = priceEl.textContent.replace(/[^0-9.-]/g, '');
                    let price = parseFloat(priceText);
                    
                    // Cleanup change
                    let changeText = changeEl ? changeEl.textContent.replace(/[^0-9.-]/g, '') : '0';
                    let change = parseFloat(changeText);
                    
                    // Cleanup volume
                    // Volume on KLSE screener is in 100 shares. So 1,000 means 100,000 shares
                    let volText = volumeEl.textContent.replace(/[^0-9.]/g, '');
                    let rawVol = parseFloat(volText);
                    let volume = rawVol * 100;
                    
                    if (!isNaN(price) && !isNaN(volume)) {
                        results.push({
                            name,
                            symbol: code + '.KL',
                            price,
                            change: isNaN(change) ? 0 : change,
                            volume
                        });
                    }
                }
            });
            return results;
        });

        console.log(`✅ Berjaya jumpa ${rawCounters.length} kaunter.`);

        let processedData = [];
        
        console.log("📊 Menganalisis Formula Smart Money (Turnover + Momentum)...");
        
        for (let data of rawCounters) {
            // Turnover = Harga Semasa * Volume Hari Ini
            const turnover = data.price * data.volume;
            
            // Filter: Abaikan penny stocks < 0.10 dan turnover < 3M
            if (turnover < 3000000) continue;
            
            let signal = "avoid";
            let reason = "Tiada signal / mendatar";
            
            if (data.change > 0 && turnover >= 3000000) {
                signal = "buy";
                reason = "Momentum Kuat & Duit Jerung Masuk";
            } else if (data.change <= 0 && turnover >= 3000000) {
                signal = "avoid";
                reason = "Jerung Buang Barang / Sikat Berbahaya";
            }

            processedData.push({
                name: data.name,
                sector: "Dynamic", // Temporary since sector is harder to grab from screener reliably
                price: data.price,
                change: data.change,
                turnover: turnover,
                volume: data.volume,
                signal: signal,
                reason: reason
            });
            
            console.log(`✅ ${data.name} dianalisis: Harga RM ${data.price.toFixed(3)} | Turnover: ${(turnover / 1000000).toFixed(2)}M`);
        }

        // Susun ikut Turnover paling tinggi
        processedData.sort((a, b) => b.turnover - a.turnover);

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedData, null, 2));
        console.log(`\n🎉 Selesai scan pasaran! Disimpan ke ${OUTPUT_FILE}`);
        
        // Simpan ke history
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        const historyDir = path.join(__dirname, 'history');
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir);
        }
        const historyFile = path.join(historyDir, `data_${dateString}.json`);
        fs.writeFileSync(historyFile, JSON.stringify(processedData, null, 2));
        console.log(`📂 Salinan sejarah disimpan ke ${historyFile}`);
        
    } catch (e) {
        console.error("❌ Ralat Web Scraping:", e);
    } finally {
        if (browser) await browser.close();
    }
}

scrapeDynamicData();
