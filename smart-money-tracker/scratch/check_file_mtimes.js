const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../live_data.js');
const jsonPath = path.join(__dirname, '../live_data.json');

console.log("=== CHECKING FILE MODIFICATION TIMES ===");
console.log(`Current Time: ${new Date().toISOString()}`);

if (fs.existsSync(jsPath)) {
    const stat = fs.statSync(jsPath);
    console.log(`- live_data.js mtime: ${stat.mtime.toISOString()}`);
} else {
    console.log("- live_data.js does not exist!");
}

if (fs.existsSync(jsonPath)) {
    const stat = fs.statSync(jsonPath);
    console.log(`- live_data.json mtime: ${stat.mtime.toISOString()}`);
} else {
    console.log("- live_data.json does not exist!");
}
