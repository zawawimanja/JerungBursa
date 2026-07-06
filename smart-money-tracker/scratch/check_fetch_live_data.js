const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../index.html');
const content = fs.readFileSync(indexFile, 'utf8');

console.log("=== INSPECTING fetchLiveData IN INDEX.HTML ===");
const lines = content.split('\n');

let print = false;
let count = 0;
for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('async function fetchLiveData()')) {
        print = true;
        count = 0;
    }
    if (print) {
        console.log(`Line ${i+1}: ${l.trim()}`);
        count++;
        if (count > 50) {
            print = false;
        }
    }
}
