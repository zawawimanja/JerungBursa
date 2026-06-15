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
    // CUSTOM VIP WATCHLIST (YAHOO FINANCE)
    // ==========================================
    const customWatchlist = [
        { symbol: '5326.KL', name: 'SKYCHIP', sector: 'Technology' },
        { symbol: '0128.KL', name: 'ZETRIX', sector: 'Technology' },
        { symbol: '0270.KL', name: 'NATGATE', sector: 'Technology' },
        { symbol: '7191.KL', name: 'GIIB', sector: 'Industrial' }
    ];

    console.log('\n🔍 Menarik data Custom VIP Watchlist dari Yahoo Finance...');
    for (const s of customWatchlist) {
        try {
            const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${s.symbol}?interval=1d&range=1d`, { headers: HEADERS });
            const meta = res.data.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const prev = meta.chartPreviousClose;
            const change = price - prev;
            const volume = meta.regularMarketVolume || 0;
            
            // Hanya tambah jika belum wujud dari i3investor
            if (!allRawStocks.has(s.name)) {
                allRawStocks.set(s.name, {
                    name: s.name,
                    price: price,
                    change: change,
                    volume: volume,
                    isVip: true,
                    sector: s.sector
                });
                console.log(`   + Tambah ${s.name} (VIP) ke dalam radar (RM ${price.toFixed(3)}).`);
            } else {
                const existing = allRawStocks.get(s.name);
                existing.isVip = true;
                existing.sector = s.sector;
                console.log(`   ~ ${s.name} (VIP) sudah pun berada dalam senarai i3investor.`);
            }
        } catch (e) {
            console.log(`   - Gagal mengambil data untuk ${s.name} (${s.symbol})`);
        }
    }

    // ==========================================
    // ANALISIS FORMULA SMART MONEY
    // ==========================================
    console.log('\n📊 Menganalisis Formula Smart Money...');
    
    const processedData = [];
    const topGainers = [];
    
    for (const [name, stock] of allRawStocks.entries()) {
        if (name.includes('-')) continue; // Skip all warrants / structured products
        
        const turnover = stock.price * stock.volume;
        // Kira peratus perubahan yang betul: (change / previous_price) * 100
        const previousPrice = stock.price - stock.change;
        const changePct = previousPrice > 0 ? (stock.change / previousPrice) * 100 : 0;
        
        // Tentukan kategori secara dinamik
        let category = 'Intraday / Momentum'; // Default
        if (stock.price < 0.20) {
            category = 'Penny / Spekulatif';
        } else if (stock.price >= 1.50) {
            category = 'Swing / Bluechip';
        }
        
        // Tentukan signal berdasarkan formula
        let signal = 'avoid';
        let reason = 'Jerung Buang / Mendatar';
        
        if (stock.change > 0 && turnover >= 3_000_000) {
            signal = 'buy';
            if (stock.price < 0.20) {
                reason = '⚠️ Penny Goreng: Pam Volume Laju (Intraday Sahaja, Elak Hold!)';
            } else if (stock.price >= 1.50) {
                if (changePct <= 3.0) {
                    reason = '🔥 Golden Hold: Jerung Mula Kumpul (Sesuai Swing/Hold)';
                } else {
                    reason = '⚡ Momentum Bluechip: Jerung Pam Kuat (Sesuai Swing/Hold)';
                }
            } else { // Mid-cap RM0.20 - RM1.50
                if (changePct <= 3.0) {
                    reason = '🔥 Golden Entry: Jerung Kumpul Selesa (Sesuai Swing/Hold)';
                } else {
                    reason = '⚡ Momentum Kuat: Jerung Mula Pam (Sesuai Intraday/Swing)';
                }
            }
        } else if (stock.isVip && stock.change <= 0) {
            reason = 'VIP Sideway / Pullback (Pantau Peluang)';
        }
        
        const dataObj = {
            name: stock.name,
            sector: stock.sector || 'Bursa',
            category,
            price: stock.price,
            change: stock.change,
            changePct: parseFloat(changePct.toFixed(2)),
            turnover,
            volume: stock.volume,
            signal,
            reason,
        };
        
        // Top Volume Scan: Simpan semua saham yang mempunyai turnover >= RM 3,000,000 ATAU ianya saham VIP
        if (turnover >= 3_000_000 || stock.isVip) {
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
