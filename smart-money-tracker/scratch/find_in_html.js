const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
    if (l.includes('calculateSmartScore')) {
        console.log(`Line ${idx + 1}: ${l.trim()}`);
    }
});
