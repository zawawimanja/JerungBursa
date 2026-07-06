const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, 'live_data.json');

const TICKERS = [
    // --- Swing / Bluechips (Peram Santai) ---
    { name: 'MAYBANK', sector: 'Financial', basePrice: 10.05, category: 'Swing' },
    { name: 'CIMB', sector: 'Financial', basePrice: 7.15, category: 'Swing' },
    { name: 'TENAGA', sector: 'Utilities', basePrice: 11.50, category: 'Swing' },
    { name: 'GAMUDA', sector: 'Construction', basePrice: 5.20, category: 'Swing' },
    { name: 'YTLPOWR', sector: 'Utilities', basePrice: 4.85, category: 'Swing' },
    { name: 'SUNWAY', sector: 'Properties', basePrice: 3.50, category: 'Swing' },
    { name: 'IJM', sector: 'Construction', basePrice: 3.10, category: 'Swing' },
    { name: 'SIMEPROP', sector: 'Properties', basePrice: 1.25, category: 'Swing' },
    { name: 'MAHSING', sector: 'Properties', basePrice: 1.85, category: 'Swing' },
    { name: 'PBBANK', sector: 'Financial', basePrice: 4.10, category: 'Swing' },
    { name: 'FRONTKN', sector: 'Technology', basePrice: 4.20, category: 'Swing' },
    
    // --- Intraday / Momentum (Hit & Run) ---
    { name: 'SKYCHIP', sector: 'Technology', basePrice: 1.45, category: 'Intraday' },
    { name: 'NOTION', sector: 'Technology', basePrice: 1.85, category: 'Intraday' },
    { name: 'MRDIY', sector: 'Consumer', basePrice: 1.55, category: 'Intraday' },
    { name: 'INARI', sector: 'Technology', basePrice: 3.20, category: 'Intraday' },
    { name: 'CTOS', sector: 'Technology', basePrice: 1.40, category: 'Intraday' },
    { name: 'MYEG', sector: 'Technology', basePrice: 0.85, category: 'Intraday' },
    { name: 'SNS', sector: 'Technology', basePrice: 0.65, category: 'Intraday' },
    { name: 'JCY', sector: 'Technology', basePrice: 0.60, category: 'Intraday' },
    { name: 'ECA', sector: 'Technology', basePrice: 0.85, category: 'Intraday' },
    { name: 'BETA', sector: 'Industrial', basePrice: 0.45, category: 'Intraday' },
    { name: 'WENTEL', sector: 'Industrial', basePrice: 0.35, category: 'Intraday' },
    { name: 'WCT', sector: 'Construction', basePrice: 0.95, category: 'Intraday' },
    { name: 'EKOVEST', sector: 'Construction', basePrice: 0.45, category: 'Intraday' },
    { name: 'TOPGLOV', sector: 'Healthcare', basePrice: 0.85, category: 'Intraday' },
    { name: 'DSONIC', sector: 'Technology', basePrice: 0.55, category: 'Intraday' },
    { name: 'UEMS', sector: 'Properties', basePrice: 1.05, category: 'Intraday' },
    
    // --- Penny / Potensi Sikat ---
    { name: 'VELESTO', sector: 'Energy', basePrice: 0.28, category: 'Penny' },
    { name: 'MINETEC', sector: 'Industrial', basePrice: 0.15, category: 'Penny' }, 
    { name: 'SAPNRG', sector: 'Energy', basePrice: 0.05, category: 'Penny' },  
    { name: 'SUNMED', sector: 'Healthcare', basePrice: 0.18, category: 'Penny' }
];

function generateMarketData() {
    console.log("Menjana data pasaran (Simulasi Live Bursa)...");
    let results = [];

    TICKERS.forEach(t => {
        // Randomize price change between -10% to +10%
        const changePercent = (Math.random() * 20 - 10); 
        const currentPrice = t.basePrice * (1 + (changePercent / 100));
        
        // Randomize volume based on typical market conditions (higher for penny stocks)
        let volumeMultiplier = currentPrice < 0.50 ? 50000000 : 5000000;
        const volume = Math.floor(Math.random() * volumeMultiplier);
        
        // Turnover = Price * Volume
        const turnover = currentPrice * volume;

        let signal = "avoid";
        let reason = "Tiada Momentum / Sikat";

        // Logic "Smart Money"
        if (changePercent > 0 && turnover >= 3000000 && currentPrice > 0.20) {
            signal = "buy";
            reason = "🔥 Momentum Kuat & Jerung Masuk";
        } else if (changePercent <= 0 && turnover >= 3000000) {
            signal = "avoid";
            reason = "⚠️ Jerung Buang Barang / Sikat Berbahaya";
        } else if (currentPrice <= 0.20) {
            signal = "avoid";
            reason = "Terlalu Murah / Risiko Sikat";
        } else if (turnover < 3000000 && currentPrice > 0.20) {
            signal = "avoid";
            reason = "Volume Kering / Sikat Mendatar";
        }

        results.push({
            name: t.name,
            sector: t.sector,
            category: t.category || "General",
            price: currentPrice,
            change: changePercent,
            turnover: turnover,
            volume: volume,
            signal: signal,
            reason: reason
        });
    });

    // Susun ikut Turnover paling tinggi
    results.sort((a, b) => b.turnover - a.turnover);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`✅ Berjaya generate & simpan ${results.length} kaunter ke ${OUTPUT_FILE}!`);
}

generateMarketData();
