const fs = require('fs');
const path = require('path');

const jsFile = path.join(__dirname, '../live_data.js');
const jsonFile = path.join(__dirname, '../live_data.json');

const jsContent = fs.readFileSync(jsFile, 'utf8');
const jsonContent = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

console.log("=== INSPECTING LIVE DATABASE FILES ===");
console.log(`- live_data.js length: ${jsContent.length} chars`);
console.log(`- live_data.json length: ${JSON.stringify(jsonContent).length} chars`);

// Extract variable definition from live_data.js
// It usually starts with "const currentData = [...]" or similar
const firstLine = jsContent.substring(0, 100);
console.log(`- live_data.js prefix: "${firstLine}"`);

const list = Array.isArray(jsonContent) ? jsonContent : (jsonContent.topVolume || []);
console.log(`- Total counters in live_data.json: ${list.length}`);
console.log("- Sample top 3 counters in live_data.json:");
list.slice(0, 3).forEach(s => {
    console.log(`  * ${s.name}: RM ${s.price} (Signal: ${s.signal}, ipoGrade: ${s.ipoGrade})`);
});
