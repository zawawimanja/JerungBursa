const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../history');
const files = fs.readdirSync(historyDir).filter(f => f.startsWith('data_') && f.endsWith('.json')).sort();

const targets = ['HEGROUP', '3REN'];
const history = { 'HEGROUP': [], '3REN': [] };

files.forEach(file => {
    const date = file.replace('data_', '').replace('.json', '');
    const raw = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.topVolume || []);
    
    list.forEach(item => {
        const name = item.name.toUpperCase().trim();
        if (targets.includes(name)) {
            history[name].push({
                date,
                price: item.price,
                setupName: item.setupName,
                setupStyle: item.setupStyle,
                high52: item.high52,
                floorLow: item.floorLow
            });
        }
    });
});

console.log("=== TREND REPORT FOR HEGROUP & 3REN ===");
targets.forEach(t => {
    console.log(`\n--- ${t} HISTORY ---`);
    history[t].forEach(h => {
        console.log(`${h.date} | Price: RM ${h.price.toFixed(3)} | Setup: ${h.setupName} | Style: ${h.setupStyle} | Floor: ${h.floorLow}`);
    });
});
