const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../index.html');
const content = fs.readFileSync(indexFile, 'utf8');

console.log("=== INSPECTING DATA LOADING IN INDEX.HTML ===");
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('liveData') || l.includes('window.liveData') || l.includes('currentData') || l.includes('loadData')) {
        if (l.includes('let') || l.includes('const') || l.includes('function') || l.includes('=')) {
            console.log(`Line ${i+1}: ${l.trim()}`);
        }
    }
}
