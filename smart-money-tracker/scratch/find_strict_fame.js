const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../history');
const files = fs.readdirSync(historyDir).filter(f => f.startsWith('data_') && f.endsWith('.json')).sort();

// We need to trace ALL tickers that appear in the files.
// Let's first build history for all stocks.
const allHistory = {}; // { ticker: [ { date, price, setupName, setupStyle, ipoPrice, ipoYear, ipoDate, name } ] }

files.forEach(file => {
    const date = file.replace('data_', '').replace('.json', '');
    const raw = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.topVolume || []);
    
    list.forEach(item => {
        const name = item.name.toUpperCase().trim();
        if (!allHistory[name]) allHistory[name] = [];
        
        allHistory[name].push({
            date,
            price: item.price,
            setupName: (item.setupName || '').toUpperCase(),
            setupStyle: (item.setupStyle || '').toUpperCase(),
            ipoPrice: item.ipoPrice || item.price,
            ipoYear: item.ipoYear,
            ipoDate: item.ipoDate,
            fullName: item.name
        });
    });
});

console.log("=== STRICT HALL OF FAME SCANNED LIST (FRESH IPO, NO DOWNTREND, GAIN) ===");
console.log("------------------------------------------------------------------------------------------------------------------");
console.log("Ticker   | Listing Date | IPO Price | Last Price | Max Gain  | Has Downtrend?");
console.log("------------------------------------------------------------------------------------------------------------------");

const fameCandidates = [];

Object.keys(allHistory).forEach(ticker => {
    const history = allHistory[ticker];
    const last = history[history.length - 1];
    
    // Check if it's a Fresh IPO (listing >= 2025)
    // We can check if ipoYear >= 2025, or if listing date is >= 2025.
    let isFresh = false;
    if (last.ipoYear !== undefined) {
        isFresh = last.ipoYear >= 2025;
    } else if (last.ipoDate) {
        // e.g. "17-Jul-2025" or "18-Jun-2026"
        const yr = parseInt(last.ipoDate.split('-')[2]);
        isFresh = yr >= 2025;
    }
    
    if (!isFresh) return;
    
    // Check setup history: did it ever enter DOWNTREND or AVOID?
    let hasDowntrend = false;
    history.forEach(h => {
        const name = h.setupName;
        const style = h.setupStyle;
        if (name.includes('DOWNTREND') || name.includes('AVOID') || style.includes('DOWNTREND') || style.includes('AVOID')) {
            hasDowntrend = true;
        }
    });
    
    if (hasDowntrend) return; // STRICT RULE: NO DOWNTREND!
    
    // Calculate gain from IPO price (or first seen price)
    const ipoPrice = history[0].price; // entry/listing price
    const currentPrice = last.price;
    const gain = ((currentPrice - ipoPrice) / ipoPrice) * 100;
    
    if (gain <= 0) return; // Must have positive trend / gain
    
    fameCandidates.push({
        ticker,
        fullName: last.fullName,
        ipoDate: last.ipoDate || 'N/A',
        ipoPrice,
        currentPrice,
        gain,
        lastSetup: last.setupName
    });
});

fameCandidates.sort((a, b) => b.gain - a.gain);

fameCandidates.forEach((c, idx) => {
    console.log(
        `${String(idx+1).padEnd(2)}. ${c.ticker.padEnd(8)} | ${c.ipoDate.padEnd(12)} | RM ${c.ipoPrice.toFixed(3)} | RM ${c.currentPrice.toFixed(3)} | +${c.gain.toFixed(2)}% | Last Setup: ${c.lastSetup}`
    );
});
console.log("------------------------------------------------------------------------------------------------------------------");
