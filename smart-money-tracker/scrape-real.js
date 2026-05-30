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

// Fungsi pembantu untuk tapisan dan parsing setiap baris jadual di i3investor
function parseTab($, tabSelector) {
    const stocks = [];
    $(tabSelector + ' .row.value').each((i, el) => {
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
                stocks.push({
                    name,
                    price,
                    change: isNaN(change) ? 0 : change,
                    volume
                });
            }
        }
    });
    return stocks;
}

async function main() {
    console.log('🚀 Jerung Bursa Scraper v3.1 (Sumber: i3investor)');
    console.log('='.repeat(55));
    
    let allRawStocks = new Map();
    
    // 1. Ambil data pasaran utama
    try {
        console.log('🌐 Menarik data dari klse.i3investor.com...');
        const res = await axios.get('https://klse.i3investor.com/web/market/mostactive', { headers: HEADERS });
        const $ = cheerio.load(res.data);
        
        const activeStocks = parseTab($, '#tab-active');
        const gainerStocks = parseTab($, '#tab-gainers');
        const loserStocks = parseTab($, '#tab-losers');
        
        console.log(`✅ Berjaya menarik: ${activeStocks.length} Aktif, ${gainerStocks.length} Gainer, ${loserStocks.length} Loser.`);
        
        // Gabungkan semua ke dalam Map unik untuk mengelakkan pertindihan data
        [...activeStocks, ...gainerStocks, ...loserStocks].forEach(s => {
            allRawStocks.set(s.name, s);
        });
        
    } catch (e) {
        console.error('❌ Gagal menarik data pasaran:', e.message);
        process.exit(1);
    }
    
    // ==========================================
    // ANALISIS FORMULA SMART MONEY
    // ==========================================
    console.log('\n📊 Menganalisis Formula Smart Money...');
    
    const processedData = [];
    const topGainers = [];
    
    for (const [name, stock] of allRawStocks.entries()) {
        const turnover = stock.price * stock.volume;
        // Kira peratus perubahan yang betul: (change / previous_price) * 100
        const previousPrice = stock.price - stock.change;
        const changePct = previousPrice > 0 ? (stock.change / previousPrice) * 100 : 0;
        
        // Tentukan signal berdasarkan formula
        let signal = 'avoid';
        let reason = 'Jerung Buang / Mendatar';
        
        if (stock.change > 0 && turnover >= 3_000_000) {
            signal = 'buy';
            reason = 'Momentum Positif & Duit Jerung Masuk';
        }
        
        const dataObj = {
            name: stock.name,
            sector: 'Dynamic',
            price: stock.price,
            change: stock.change,
            changePct: parseFloat(changePct.toFixed(2)),
            turnover,
            volume: stock.volume,
            signal,
            reason,
        };
        
        // Top Volume Scan: Simpan semua saham yang mempunyai turnover >= RM 3,000,000
        if (turnover >= 3_000_000) {
            processedData.push(dataObj);
        }
        
        // Top Gainers Scan: Simpan semua saham yang mencatatkan kenaikan peratusan positif
        if (stock.change > 0) {
            topGainers.push({
                name: stock.name,
                price: stock.price,
                changePct: parseFloat(changePct.toFixed(2)),
                volume: stock.volume,
                turnover
            });
        }
    }
    
    // Susun processedData mengikut turnover tertinggi
    processedData.sort((a, b) => b.turnover - a.turnover);
    
    // Susun topGainers mengikut peratus kenaikan tertinggi
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
    
    // Simpan rekod sejarah (history)
    const dateStr = new Date().toISOString().split('T')[0];
    const histDir = path.join(__dirname, 'history');
    if (!fs.existsSync(histDir)) fs.mkdirSync(histDir);
    fs.writeFileSync(path.join(histDir, `data_${dateStr}.json`), JSON.stringify(output, null, 2));
    
    // Paparan pratonton 5 terbaik
    console.log('\n📋 Top 5 (Turnover):');
    processedData.slice(0, 5).forEach((s, i) => {
        console.log(`  ${i+1}. ${s.name} | RM${s.price.toFixed(3)} | ${s.changePct >= 0 ? '+' : ''}${s.changePct}% | Turnover: RM${(s.turnover/1e6).toFixed(2)}M | ${s.signal.toUpperCase()}`);
    });
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
