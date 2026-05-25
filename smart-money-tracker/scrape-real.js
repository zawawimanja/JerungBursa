const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const TICKERS = [
    // Financial & Core Swing
    { name: 'MAYBANK', symbol: '1155.KL', sector: 'Financial', category: 'Swing' },
    { name: 'CIMB', symbol: '1023.KL', sector: 'Financial', category: 'Swing' },
    { name: 'PBBANK', symbol: '1295.KL', sector: 'Financial', category: 'Swing' },
    { name: 'TENAGA', symbol: '5347.KL', sector: 'Utilities', category: 'Swing' },
    { name: 'YTLPOWR', symbol: '6742.KL', sector: 'Utilities', category: 'Swing' },
    { name: 'YTL', symbol: '4677.KL', sector: 'Utilities', category: 'Swing' },
    { name: 'GAMUDA', symbol: '5398.KL', sector: 'Construction', category: 'Swing' },
    { name: 'SUNWAY', symbol: '5211.KL', sector: 'Properties', category: 'Swing' },
    { name: 'IJM', symbol: '3336.KL', sector: 'Construction', category: 'Swing' },
    { name: 'WCT', symbol: '9679.KL', sector: 'Construction', category: 'Intraday' },
    { name: 'MRCB', symbol: '1651.KL', sector: 'Construction', category: 'Intraday' },
    { name: 'EKOVEST', symbol: '8877.KL', sector: 'Construction', category: 'Intraday' },
    // Telecom & Energy
    { name: 'TELEKOM', symbol: '4863.KL', sector: 'Telecommunications', category: 'Swing' },
    { name: 'MAXIS', symbol: '6012.KL', sector: 'Telecommunications', category: 'Swing' },
    { name: 'CELCOMDIGI', symbol: '6947.KL', sector: 'Telecommunications', category: 'Swing' },
    { name: 'DIALOG', symbol: '7277.KL', sector: 'Energy', category: 'Swing' },
    { name: 'VELESTO', symbol: '5243.KL', sector: 'Energy', category: 'Penny' },
    { name: 'DAYANG', symbol: '5141.KL', sector: 'Energy', category: 'Intraday' },
    { name: 'WASCO', symbol: '5142.KL', sector: 'Energy', category: 'Intraday' },
    { name: 'UZMA', symbol: '7250.KL', sector: 'Energy', category: 'Intraday' },
    // Technology
    { name: 'INARI', symbol: '0166.KL', sector: 'Technology', category: 'Intraday' },
    { name: 'MYEG', symbol: '0138.KL', sector: 'Technology', category: 'Intraday' },
    { name: 'SKYCHIP', symbol: '5357.KL', sector: 'Technology', category: 'Intraday' },
    { name: 'NOTION', symbol: '0083.KL', sector: 'Technology', category: 'Intraday' },
    { name: 'DSONIC', symbol: '5216.KL', sector: 'Technology', category: 'Intraday' },
    { name: 'JCY', symbol: '5161.KL', sector: 'Technology', category: 'Intraday' },
    { name: 'DNEX', symbol: '4456.KL', sector: 'Technology', category: 'Intraday' },
    { name: 'FRONTKN', symbol: '0128.KL', sector: 'Technology', category: 'Swing' },
    { name: 'GTRONIC', symbol: '7022.KL', sector: 'Technology', category: 'Intraday' },
    { name: 'MPI', symbol: '3867.KL', sector: 'Technology', category: 'Swing' },
    // Property
    { name: 'SIMEPROP', symbol: '5288.KL', sector: 'Properties', category: 'Swing' },
    { name: 'SPSETIA', symbol: '8664.KL', sector: 'Properties', category: 'Swing' },
    { name: 'UEMS', symbol: '5148.KL', sector: 'Properties', category: 'Swing' },
    { name: 'MAHSING', symbol: '8583.KL', sector: 'Properties', category: 'Swing' },
    { name: 'ECOWLD', symbol: '8206.KL', sector: 'Properties', category: 'Swing' },
    // Consumer & Others
    { name: 'MRDIY', symbol: '5296.KL', sector: 'Consumer', category: 'Intraday' },
    { name: 'CAPITALA', symbol: '5099.KL', sector: 'Consumer', category: 'Intraday' },
    { name: 'AAX', symbol: '5238.KL', sector: 'Consumer', category: 'Intraday' },
    { name: 'SIME', symbol: '4197.KL', sector: 'Consumer', category: 'Swing' },
    // Healthcare
    { name: 'KPJ', symbol: '5878.KL', sector: 'Healthcare', category: 'Swing' },
    { name: 'TOPGLOV', symbol: '7113.KL', sector: 'Healthcare', category: 'Intraday' },
    { name: 'KOSSAN', symbol: '7153.KL', sector: 'Healthcare', category: 'Intraday' },
    { name: 'SUPERMX', symbol: '7106.KL', sector: 'Healthcare', category: 'Intraday' }
];

(async () => {
    console.log("🚀 Memulakan enjin Puppeteer Stealth...");
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    
    console.log("🌐 Mendapatkan 'pass' keselamatan dari Yahoo Finance...");
    try {
        await page.goto('https://finance.yahoo.com', {waitUntil: 'domcontentloaded', timeout: 15000});
    } catch(e) {
        console.log("⚠️ Yahoo Finance loading slow, continuing anyway...");
    }
    
    console.log("📊 Menyedut data live pasaran Bursa...");
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
                    reason = "🔥 Momentum Kuat & Jerung Masuk";
                } else if (changePercent <= 0 && turnover > 5000000) {
                    reason = "⚠️ Jerung Buang Barang / Markup";
                }

                results.push({
                    name: t.name,
                    sector: t.sector,
                    category: t.category,
                    price: price,
                    change: changePercent,
                    turnover: turnover,
                    volume: volume,
                    signal: signal,
                    reason: reason
                });
                console.log(`✅ ${t.name} disedut: RM ${price.toFixed(3)}`);
            } else {
                console.log(`❌ Gagal dapatkan data ${t.name}`);
            }
        } catch (e) {
            console.log(`❌ Ralat pada ${t.name}: ${e.message}`);
        }
    }
    
    const outputPath = path.join(__dirname, 'live_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n🎉 Selesai! Disimpan ke ${outputPath}`);
    
    await browser.close();
})();
