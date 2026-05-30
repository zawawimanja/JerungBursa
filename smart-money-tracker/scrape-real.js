const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const OUTPUT_FILE = path.join(__dirname, 'live_data.json');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
};

// =============================================
// FORMULA:
//   Turnover  = Harga × Volume
//   Filter 1  = Turnover >= RM 3,000,000 (Duit Besar)
//   Filter 2  = Harga    <= RM 3.00      (Harga Masuk)
//   Filter 3  = Kenaikan < 3%            (Belum Melambung)
//   Signal    = BUY kalau change > 0 & turnover >= 3M
//             = AVOID kalau change <= 0
// =============================================

async function scrapeTopVolume() {
    console.log('🌐 Menarik data Top Volume dari klse.i3investor.com...');
    
    const res = await axios.get('https://klse.i3investor.com/web/market/mostactive', { headers: HEADERS });
    const $ = cheerio.load(res.data);
    
    const rawStocks = [];
    
    // Data ada dalam div.row.value | col-4 (name) | col-2 (price) | col-2 (change) | col-4 (volume)
    $('.row.value').each((i, el) => {
        const cols = $(el).find('div[class*="col-"]');
        if (cols.length >= 4) {
            const name = $(cols[0]).find('strong').text().trim();
            const priceText = $(cols[1]).find('strong').text().trim();
            const changeText = $(cols[2]).find('strong').text().trim();
            const volumeText = $(cols[3]).find('strong').text().trim();
            
            const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
            const change = parseFloat(changeText.replace(/[^0-9.-]/g, ''));
            const volume = parseInt(volumeText.replace(/[^0-9]/g, ''), 10);
            
            if (name && !isNaN(price) && !isNaN(volume) && volume > 0) {
                rawStocks.push({ name, price, change: isNaN(change) ? 0 : change, volume });
            }
        }
    });
    
    console.log(`✅ Jumpa ${rawStocks.length} saham dari i3investor.`);
    return rawStocks;
}

async function scrapeTopGainers() {
    console.log('📈 Menarik data Top Gainers dari klse.i3investor.com...');
    
    const res = await axios.get('https://klse.i3investor.com/web/market/topgainer', { headers: HEADERS });
    const $ = cheerio.load(res.data);
    
    const gainers = [];
    
    $('.row.value').each((i, el) => {
        const cols = $(el).find('div[class*="col-"]');
        if (cols.length >= 4) {
            const name = $(cols[0]).find('strong').text().trim();
            const priceText = $(cols[1]).find('strong').text().trim();
            const changeText = $(cols[2]).find('strong').text().trim();
            const volumeText = $(cols[3]).find('strong').text().trim();
            
            const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
            const changePct = parseFloat(changeText.replace(/[^0-9.-]/g, ''));
            const volume = parseInt(volumeText.replace(/[^0-9]/g, ''), 10);
            
            if (name && !isNaN(price)) {
                gainers.push({ name, price, changePct: isNaN(changePct) ? 0 : changePct, volume: isNaN(volume) ? 0 : volume });
            }
        }
    });
    
    console.log(`✅ Jumpa ${gainers.length} saham gainer.`);
    return gainers;
}

async function main() {
    console.log('🚀 Jerung Bursa Scraper v3.0 (Sumber: i3investor)');
    console.log('='.repeat(55));
    
    let topVolume = [], topGainers = [];
    
    try {
        topVolume = await scrapeTopVolume();
    } catch (e) {
        console.error('❌ Gagal scrape top volume:', e.message);
    }
    
    try {
        topGainers = await scrapeTopGainers();
    } catch (e) {
        console.error('❌ Gagal scrape top gainers:', e.message);
    }
    
    if (topVolume.length === 0) {
        console.error('❌ Tiada data. Henti.');
        process.exit(1);
    }
    
    // ==========================================
    // ANALISIS FORMULA SMART MONEY
    // ==========================================
    console.log('\n📊 Menganalisis Formula Smart Money...');
    
    const processedData = [];
    
    for (const stock of topVolume) {
        // Turnover = Harga × Volume
        const turnover = stock.price * stock.volume;
        
        // Kira peratus perubahan (change sudah dalam RM, tukar ke %)
        const changePct = stock.price > 0 ? (stock.change / (stock.price - stock.change)) * 100 : 0;
        
        // Filter: Turnover < 3M → skip
        if (turnover < 3_000_000) continue;
        
        // Signal berdasarkan formula
        let signal = 'avoid';
        let reason = 'Jerung Buang / Mendatar';
        
        if (stock.change > 0 && turnover >= 3_000_000) {
            signal = 'buy';
            reason = 'Momentum Positif & Duit Jerung Masuk';
        }
        
        processedData.push({
            name: stock.name,
            sector: 'Dynamic',
            price: stock.price,
            change: stock.change,
            changePct: parseFloat(changePct.toFixed(2)),
            turnover,
            volume: stock.volume,
            signal,
            reason,
        });
    }
    
    // Susun ikut turnover tertinggi
    processedData.sort((a, b) => b.turnover - a.turnover);
    
    // Susun top gainers
    topGainers.sort((a, b) => b.changePct - a.changePct);
    
    const output = {
        lastUpdated: new Date().toISOString(),
        source: 'klse.i3investor.com',
        topVolume: processedData,
        topGainers: topGainers.slice(0, 20),
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\n🎉 Selesai! ${processedData.length} saham dianalisis.`);
    console.log(`📂 Disimpan ke ${OUTPUT_FILE}`);
    
    // Simpan history
    const dateStr = new Date().toISOString().split('T')[0];
    const histDir = path.join(__dirname, 'history');
    if (!fs.existsSync(histDir)) fs.mkdirSync(histDir);
    fs.writeFileSync(path.join(histDir, `data_${dateStr}.json`), JSON.stringify(output, null, 2));
    
    // Preview top 5
    console.log('\n📋 Top 5 (Turnover):');
    processedData.slice(0, 5).forEach((s, i) => {
        console.log(`  ${i+1}. ${s.name} | RM${s.price.toFixed(3)} | ${s.changePct >= 0 ? '+' : ''}${s.changePct}% | Turnover: RM${(s.turnover/1e6).toFixed(2)}M | ${s.signal.toUpperCase()}`);
    });
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
