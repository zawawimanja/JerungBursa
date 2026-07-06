const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../index.html');
const content = fs.readFileSync(indexFile, 'utf8');

console.log("=== INSPECTING SCRIPT TAGS IN INDEX.HTML ===");
const lines = content.split('\n');
lines.forEach((l, idx) => {
    if (l.includes('live_data.js') || l.includes('script src')) {
        console.log(`Line ${idx + 1}: ${l.trim()}`);
    }
});
