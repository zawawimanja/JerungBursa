const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../history');
const files = fs.readdirSync(historyDir).filter(f => f.startsWith('data_') && f.endsWith('.json')).sort();

// Collect all daily prices for tracing:
const priceHistory = {}; // { ticker: { date: price } }
const datesList = [];

files.forEach(file => {
    const date = file.replace('data_', '').replace('.json', '');
    datesList.push(date);
    const raw = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.topVolume || []);
    list.forEach(item => {
        const name = item.name.toUpperCase().trim();
        if (!priceHistory[name]) priceHistory[name] = {};
        priceHistory[name][date] = item.price;
    });
});

// New triggers list:
const newTriggers = [
    { date: '2026-06-12', name: 'GDGROUP', entryPrice: 0.315, floor: 0.300 }, // Let's verify prices on those dates
    { date: '2026-06-15', name: 'ISF', entryPrice: 0.380, floor: 0.360 },
    { date: '2026-06-15', name: 'GDGROUP', entryPrice: 0.320, floor: 0.300 },
    { date: '2026-06-19', name: 'GDGROUP', entryPrice: 0.335, floor: 0.315 },
    { date: '2026-06-25', name: 'OGX', entryPrice: 0.505, floor: 0.485 },
    { date: '2026-06-25', name: 'AMBEST', entryPrice: 0.770, floor: 0.735 },
    { date: '2026-06-26', name: 'ISF', entryPrice: 0.365, floor: 0.350 },
    { date: '2026-06-29', name: 'PENTECH', entryPrice: 0.755, floor: 0.725 },
    { date: '2026-07-01', name: 'ELSA', entryPrice: 0.690, floor: 0.660 }
];

console.log("=== TRACING P&L FOR NEW TRIGGERS ===");
console.log("------------------------------------------------------------------------------------------------------------------------");
console.log("Date       | Stock    | Entry Price | Stop Loss   | Outcome / Max Return / Current Return");
console.log("------------------------------------------------------------------------------------------------------------------------");

newTriggers.forEach(t => {
    const name = t.name.toUpperCase().trim();
    // Re-verify exact entry price & floor from the specific date file:
    const file = files.find(f => f.includes(t.date));
    if (!file) return;
    
    const raw = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.topVolume || []);
    const item = list.find(s => s.name.toUpperCase().trim() === name);
    if (!item) return;
    
    const entryPrice = item.price;
    const floor = item.floorLow || (entryPrice * 0.95);
    const sl = floor * 0.97;
    
    // Trace from trigger date onwards:
    const startIndex = datesList.indexOf(t.date);
    let slHit = false;
    let tp10Hit = false;
    let maxPrice = entryPrice;
    let finalReturn = 0;
    let outcomeText = "";
    
    for (let i = startIndex + 1; i < datesList.length; i++) {
        const d = datesList[i];
        const histPrice = priceHistory[name][d];
        if (histPrice === undefined) continue;
        
        if (histPrice > maxPrice) {
            maxPrice = histPrice;
        }
        
        // Check Stop Loss first:
        if (histPrice <= sl) {
            slHit = true;
            finalReturn = ((sl - entryPrice) / entryPrice) * 100;
            outcomeText = `❌ SL Hit on ${d} (${finalReturn.toFixed(2)}%)`;
            break;
        }
        
        // Check TP10 (+10%):
        if (histPrice >= entryPrice * 1.10) {
            tp10Hit = true;
        }
    }
    
    if (!slHit) {
        // Still active or reached TP
        const lastDate = datesList[datesList.length - 1];
        const currentPrice = priceHistory[name][lastDate] || entryPrice;
        const currentReturn = ((currentPrice - entryPrice) / entryPrice) * 100;
        const maxReturn = ((maxPrice - entryPrice) / entryPrice) * 100;
        
        if (tp10Hit) {
            outcomeText = `🟢 TP10+ Hit! Max: +${maxReturn.toFixed(2)}% | Current: ${currentReturn >= 0 ? '+' : ''}${currentReturn.toFixed(2)}%`;
        } else {
            outcomeText = `⏳ Active | Max: +${maxReturn.toFixed(2)}% | Current: ${currentReturn >= 0 ? '+' : ''}${currentReturn.toFixed(2)}%`;
        }
    }
    
    console.log(`${t.date} | ${name.padEnd(8)} | RM ${entryPrice.toFixed(3)}  | RM ${sl.toFixed(3)}  | ${outcomeText}`);
});
console.log("------------------------------------------------------------------------------------------------------------------------");
