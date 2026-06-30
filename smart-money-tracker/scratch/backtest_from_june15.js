const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HISTORY_DIR = path.join(__dirname, '../history');
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

let symbolMappings = {};
try {
    symbolMappings = JSON.parse(fs.readFileSync(path.join(__dirname, '../symbol_mappings.json'), 'utf8'));
} catch (e) {
    console.error("Warning: symbol_mappings.json not found");
}

function getTickerSymbol(name) {
    if (symbolMappings[name]) return symbolMappings[name];
    return name + '.KL';
}

async function run() {
    console.log("🔍 Menjalankan Backtest Khas dari 15 Jun 2026...");
    
    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('data_') && f.endsWith('.json'))
        .sort();
        
    const signals = [];
    
    for (const file of files) {
        const dateStr = file.replace('data_', '').replace('.json', '');
        if (dateStr < '2026-06-15') continue; // Only June 15 onwards
        
        const filePath = path.join(HISTORY_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath));
        const topVolume = data.topVolume || data.data || [];
        
        for (const item of topVolume) {
            const floor = item.floorLow || (item.price * 0.97);
            const dist = parseFloat((((item.price - floor) / floor) * 100).toFixed(2));
            const isDowntrend = item.setupName && (
                item.setupName.includes('Downtrend') || 
                item.setupName.includes('Avoid') || 
                item.setupName === 'N/A'
            );
            
            // Criteria:
            if (item.isConsolidation && 
                !isDowntrend && 
                item.touchCount >= 3 && 
                dist <= 3.0) {
                
                signals.push({
                    date: dateStr,
                    name: item.name,
                    price: item.price,
                    floor: floor,
                    dist: dist,
                    touches: item.touchCount,
                    reason: item.reason,
                    hasLowerWickRejection: item.hasLowerWickRejection
                });
            }
        }
    }
    
    console.log(`\n📊 Dijumpai ${signals.length} isyarat setup dari 15 Jun 2026. Menganalisis prestasi...`);
    
    const results = [];
    
    for (const sig of signals) {
        const symbol = getTickerSymbol(sig.name);
        try {
            const yRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, { headers: HEADERS });
            if (!yRes.data || !yRes.data.chart || !yRes.data.chart.result || !yRes.data.chart.result[0]) continue;
            
            const result = yRes.data.chart.result[0];
            const timestamp = result.timestamp;
            const quote = result.indicators.quote[0];
            
            let sigIndex = -1;
            for (let i = 0; i < timestamp.length; i++) {
                const d = new Date(timestamp[i] * 1000).toISOString().split('T')[0];
                if (d === sig.date) {
                    sigIndex = i;
                    break;
                }
            }
            
            if (sigIndex === -1) continue;
            
            const cPrice = quote.close[sigIndex];
            if (cPrice === null) continue;
            
            // Monitor next 5 trading days
            let maxPriceAhead = cPrice;
            let minPriceAhead = cPrice;
            const lookAheadDays = 5;
            let endIdx = Math.min(sigIndex + lookAheadDays, timestamp.length - 1);
            
            for (let j = sigIndex + 1; j <= endIdx; j++) {
                if (quote.high[j] !== null && quote.high[j] > maxPriceAhead) maxPriceAhead = quote.high[j];
                if (quote.low[j] !== null && quote.low[j] < minPriceAhead) minPriceAhead = quote.low[j];
            }
            
            const maxReturn = ((maxPriceAhead - cPrice) / cPrice) * 100;
            const maxDrawdown = ((minPriceAhead - cPrice) / cPrice) * 100;
            
            // Stop Loss set to 3.0% below the floor low
            const stopLossLevel = -(sig.dist + 3.0);
            
            let status = '➖ MENDATAR (Sideway)';
            if (maxDrawdown < stopLossLevel) {
                status = '❌ KENA SL (Cut Loss)';
            } else if (maxReturn >= 3.0) {
                status = '✅ BERJAYA (Profit)';
            }
            
            results.push({
                date: sig.date,
                name: sig.name,
                price: cPrice,
                hasLowerWickRejection: sig.hasLowerWickRejection,
                maxReturn: maxReturn,
                maxDrawdown: maxDrawdown,
                stopLossLevel: stopLossLevel,
                status
            });
            
        } catch (err) {
            console.log(`  ❌ Gagal memproses ${sig.name} (${symbol}): ${err.message}`);
        }
    }
    
    console.log("\n==========================================================================================");
    console.log("             🏆 LAPORAN PRESTASI DARI 15 JUN 2026 (DAILY 1D MODEL)       ");
    console.log("==========================================================================================");
    
    results.forEach(r => {
        const wickIcon = r.hasLowerWickRejection ? '👑' : '⚠️';
        console.log(`  📅 ${r.date} | ${wickIcon} ${r.name.padEnd(8)} | Harga: RM ${r.price.toFixed(3)} | Max Gain: +${r.maxReturn.toFixed(2)}% | Max DD: ${r.maxDrawdown.toFixed(2)}% (SL: ${r.stopLossLevel.toFixed(1)}%) | Status: ${r.status}`);
    });
    
    // Overall Stats
    const total = results.length;
    const wins = results.filter(r => r.status === '✅ BERJAYA (Profit)').length;
    const losses = results.filter(r => r.status === '❌ KENA SL (Cut Loss)').length;
    const sideways = results.filter(r => r.status === '➖ MENDATAR (Sideway)').length;
    const winRate = total > 0 ? (wins / (wins + losses)) * 100 : 0;
    
    console.log("\n------------------------------------------------------------------------------------------");
    console.log(`📊 RINGKASAN PRESTASI:`);
    console.log(`   - Jumlah Isyarat: ${total}`);
    console.log(`   - ✅ Berjaya: ${wins}`);
    console.log(`   - ❌ Kena SL: ${losses}`);
    console.log(`   - ➖ Mendatar (Masih Aktif): ${sideways}`);
    console.log(`   - 🎯 Win Rate (Excl. Sideways): ${winRate.toFixed(2)}%`);
    console.log("==========================================================================================\n");
}

run();
