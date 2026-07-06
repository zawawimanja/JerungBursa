const fs = require('fs');
const path = require('path');

const file3 = path.join(__dirname, '../history/data_2026-07-03.json');
const raw = JSON.parse(fs.readFileSync(file3, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.topVolume || []);

console.log("=== INSPECTING JULY 3RD, 2026 HISTORY FILE ===");
const targets = ['ISF', 'AMBEST', 'TEAMSTR', 'OXB'];
targets.forEach(name => {
    const item = list.find(s => s.name === name);
    if (item) {
        console.log(`\nFound target: ${name}`);
        console.log(`- Price: RM ${item.price}`);
        console.log(`- Turnover: RM ${item.turnover}`);
        console.log(`- ipoGrade: ${item.ipoGrade}`);
        console.log(`- signal: ${item.signal}`);
        console.log(`- reason: ${item.reason}`);
    } else {
        console.log(`\nTarget not found in July 3rd: ${name}`);
    }
});
