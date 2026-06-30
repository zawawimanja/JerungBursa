const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HISTORY_DIR = path.join(__dirname, '../history');
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

let symbolMappings = {};
try {
    symbolMappings = JSON.parse(fs.readFileSync(path.join(__dirname, '../symbol_mappings.json'), 'utf8'));
} catch (e) {
    console.error("Warning: symbol_mappings.json not found, using fallbacks");
}

function getTickerSymbol(name) {
    if (symbolMappings[name]) return symbolMappings[name];
    return name + '.KL';
}

async function runBacktest() {
    console.log("🔍 Memulakan backtest data arkib untuk Setup Emas (Ala-OGX)...");
    
    // 1. Baca semua fail sejarah harian
    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('data_') && f.endsWith('.json'))
        .sort(); // Urutan kronologi
        
    const signals = [];
    
    for (const file of files) {
        const dateStr = file.replace('data_', '').replace('.json', '');
        const filePath = path.join(HISTORY_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath));
        const topVolume = data.topVolume || [];
        
        for (const item of topVolume) {
            const floor = item.floorLow || (item.price * 0.97);
            const dist = parseFloat((((item.price - floor) / floor) * 100).toFixed(2));
            const isDowntrend = item.setupName && (
                item.setupName.includes('Downtrend') || 
                item.setupName.includes('Avoid') || 
                item.setupName === 'N/A'
            );
            
            // Kriteria Asas (Sebelum Tapis Reject Ekor Harian):
            if (item.isConsolidation && 
                item.signal === 'buy' && 
                !isDowntrend && 
                item.price <= 3.00 && 
                item.touchCount >= 3 && 
                dist <= 3.0) {
                
                signals.push({
                    date: dateStr,
                    name: item.name,
                    price: item.price,
                    floor: floor,
                    dist: dist,
                    touches: item.touchCount,
                    reason: item.reason
                });
            }
        }
    }
    
    console.log(`\n📊 Menjumpai ${signals.length} isyarat asas. Menarik data harian dari Yahoo Finance untuk pengesahan...`);
    
    const results = [];
    
    for (const sig of signals) {
        const symbol = getTickerSymbol(sig.name);
        try {
            // Tarik data harian untuk kaunter ini
            const yRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, { headers: HEADERS });
            if (!yRes.data || !yRes.data.chart || !yRes.data.chart.result || !yRes.data.chart.result[0]) {
                continue;
            }
            
            const result = yRes.data.chart.result[0];
            const timestamp = result.timestamp;
            const quote = result.indicators.quote[0];
            const close = quote.close;
            const low = quote.low;
            const high = quote.high;
            const open = quote.open;
            
            // Cari indeks untuk tarikh isyarat
            let sigIndex = -1;
            for (let i = 0; i < timestamp.length; i++) {
                const d = new Date(timestamp[i] * 1000).toISOString().split('T')[0];
                if (d === sig.date) {
                    sigIndex = i;
                    break;
                }
            }
            
            if (sigIndex === -1) {
                // Jika tidak jumpa tarikh tepat, cari yang paling hampir
                for (let i = 0; i < timestamp.length; i++) {
                    const d = new Date(timestamp[i] * 1000).toISOString().split('T')[0];
                    if (d.startsWith(sig.date.substring(0, 7))) {
                        const diffDays = Math.abs(new Date(d) - new Date(sig.date)) / (1000 * 60 * 60 * 24);
                        if (diffDays <= 2) {
                            sigIndex = i;
                            break;
                        }
                    }
                }
            }
            
            if (sigIndex === -1) continue;
            
            // Hitung Lower Wick Rejection harian pada tarikh isyarat
            const oPrice = open[sigIndex];
            const cPrice = close[sigIndex];
            const hPrice = high[sigIndex];
            const lPrice = low[sigIndex];
            
            if (oPrice === null || cPrice === null || hPrice === null || lPrice === null) continue;
            
            const body = Math.abs(cPrice - oPrice);
            const lowerShadow = Math.min(oPrice, cPrice) - lPrice;
            const totalRange = hPrice - lPrice;
            
            const hasLowerWickRejection = totalRange > 0 && (
                (dailyLowerShadow => {
                    const shadowRatio = dailyLowerShadow / totalRange;
                    const bodyRatio = body > 0 ? dailyLowerShadow / body : 0;
                    return shadowRatio >= 0.20 || bodyRatio >= 0.40 || (body === 0 && dailyLowerShadow > 0);
                })(lowerShadow)
            );
            
            // Pantau prestasi untuk 5 hari dagangan seterusnya
            let maxPriceAhead = cPrice;
            let minPriceAhead = cPrice;
            const lookAheadDays = 5;
            let endIdx = Math.min(sigIndex + lookAheadDays, timestamp.length - 1);
            
            for (let j = sigIndex + 1; j <= endIdx; j++) {
                if (high[j] !== null && high[j] > maxPriceAhead) maxPriceAhead = high[j];
                if (low[j] !== null && low[j] < minPriceAhead) minPriceAhead = low[j];
            }
            
            const maxReturn = ((maxPriceAhead - cPrice) / cPrice) * 100;
            const maxDrawdown = ((minPriceAhead - cPrice) / cPrice) * 100;
            
            // Keputusan: Stop Loss 3% di bawah lantai sokongan
            const stopLossLevel = -(sig.dist + 3.0);
            
            let status = '❌ GAGAL';
            if (maxDrawdown > stopLossLevel) {
                if (maxReturn >= 8.0) {
                    status = '🚀 MELETUP (Gila-Gila!)';
                } else if (maxReturn >= 3.0) {
                    status = '✅ BERJAYA (Profit)';
                } else {
                    status = '➖ MENDATAR (Sideway)';
                }
            } else {
                status = '❌ KENA SL (Cut Loss)';
            }
            
            results.push({
                date: sig.date,
                name: sig.name,
                price: cPrice,
                hasLowerWickRejection,
                maxReturn: parseFloat(maxReturn.toFixed(2)),
                maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
                status
            });
            
        } catch (err) {
            console.log(`  ❌ Gagal memproses ${sig.name} (${symbol}): ${err.message}`);
        }
    }
    
    console.log("\n==========================================================================================");
    console.log("             🏆 LAPORAN BACKTEST PRESTASI SETUP EMAS (ALA-OGX)            ");
    console.log("==========================================================================================");
    
    // Tapis isyarat yang LULUS Reject Ekor sahaja (SOP Mutlak)
    const strictResults = results.filter(r => r.hasLowerWickRejection);
    
    console.log(`\n1. 👑 SOP Mutlak (Dengan Reject Ekor Bawah):`);
    strictResults.forEach(r => {
        console.log(`  📅 ${r.date} | 📈 ${r.name.padEnd(8)} | Harga: RM ${r.price.toFixed(3)} | Max Gain: +${r.maxReturn.toFixed(2)}% | Max Drawdown: ${r.maxDrawdown.toFixed(2)}% | Keputusan: ${r.status}`);
    });
    
    const winStrict = strictResults.filter(r => r.status.includes('BERJAYA') || r.status.includes('MELETUP')).length;
    const lossStrict = strictResults.filter(r => r.status.includes('SL') || r.status.includes('GAGAL')).length;
    const winRateStrict = strictResults.length > 0 ? (winStrict / (winStrict + lossStrict)) * 100 : 0;
    
    console.log(`\n👉 Win Rate SOP Mutlak: ${winRateStrict.toFixed(2)}% (${winStrict} Berjaya, ${lossStrict} Gagal)`);
    
    console.log("\n------------------------------------------------------------------------------------------");
    console.log(`2. ⚠️ Tanpa Tapisan Reject Ekor Bawah (Untuk Perbandingan):`);
    const looseResults = results.filter(r => !r.hasLowerWickRejection);
    looseResults.forEach(r => {
        console.log(`  📅 ${r.date} | 📈 ${r.name.padEnd(8)} | Harga: RM ${r.price.toFixed(3)} | Max Gain: +${r.maxReturn.toFixed(2)}% | Max Drawdown: ${r.maxDrawdown.toFixed(2)}% | Keputusan: ${r.status}`);
    });
    
    const winLoose = looseResults.filter(r => r.status.includes('BERJAYA') || r.status.includes('MELETUP')).length;
    const lossLoose = looseResults.filter(r => r.status.includes('SL') || r.status.includes('GAGAL')).length;
    const winRateLoose = looseResults.length > 0 ? (winLoose / (winLoose + lossLoose)) * 100 : 0;
    
    console.log(`\n👉 Win Rate Tanpa Reject Ekor: ${winRateLoose.toFixed(2)}% (${winLoose} Berjaya, ${lossLoose} Gagal)`);
    console.log("==========================================================================================\n");
}

runBacktest();
