const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../history');
const files = fs.readdirSync(historyDir).filter(f => f.startsWith('data_') && f.endsWith('.json')).sort();

const freshIpos = [
    'SKYECHIP', 'PENTECH', 'SUM', 'ELSA', 'AMBEST', 'AMS',
    'EIPOWER', 'ISF', 'KEEMING', 'TEAMSTR', 'MMCS', 'GDGROUP',
    'GOLDLI', 'HOCKSOON', 'OGX', 'SBS', 'SRKK', 'EMPIRE'
];

// Let's trace each fresh IPO's setup history
const setupHistory = {}; // { ticker: [ { date, price, setupName, setupStyle, high52, floorLow } ] }

files.forEach(file => {
    const date = file.replace('data_', '').replace('.json', '');
    const raw = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.topVolume || []);
    
    list.forEach(item => {
        const name = item.name.toUpperCase().trim();
        if (freshIpos.includes(name)) {
            if (!setupHistory[name]) setupHistory[name] = [];
            setupHistory[name].push({
                date,
                price: item.price,
                setupName: (item.setupName || '').toUpperCase(),
                setupStyle: (item.setupStyle || '').toUpperCase(),
                high52: item.high52,
                floorLow: item.floorLow
            });
        }
    });
});

console.log("=== ANALYZING FRESH IPO TREND PROFILES ===");
console.log("------------------------------------------------------------------------------------------------------------------");
console.log("Ticker   | Total Days | Min Price | Max Price | Has Downtrend / Avoid? | Current Status (Last Date)");
console.log("------------------------------------------------------------------------------------------------------------------");

Object.keys(setupHistory).forEach(ticker => {
    const history = setupHistory[ticker];
    const prices = history.map(h => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    let hasDowntrend = false;
    let downtrendDates = [];
    
    history.forEach(h => {
        if (h.setupName.includes('DOWNTREND') || h.setupName.includes('AVOID') || h.setupStyle.includes('DOWNTREND') || h.setupStyle.includes('AVOID')) {
            hasDowntrend = true;
            downtrendDates.push(h.date);
        }
    });
    
    const last = history[history.length - 1];
    const statusText = `Price: RM ${last.price.toFixed(3)} | Setup: ${last.setupName}`;
    
    console.log(
        `${ticker.padEnd(8)} | ${String(history.length).padStart(10)} | RM ${minPrice.toFixed(3)} | RM ${maxPrice.toFixed(3)} | ${hasDowntrend ? ('YES (' + downtrendDates.length + ' days)').padEnd(22) : 'NO 🟢'.padEnd(22)} | ${statusText}`
    );
});
console.log("------------------------------------------------------------------------------------------------------------------");
