const fs = require('fs');
const path = require('path');

const backtestFile = path.join(__dirname, '../backtest.html');
const content = fs.readFileSync(backtestFile, 'utf8');

const startIdx = content.indexOf('const fullData = [');
const endIdx = content.indexOf('];', startIdx);
const arrayString = content.substring(startIdx + 17, endIdx + 1);
const fullData = eval(arrayString);

console.log("=== FIRST TRADE OBJECT IN BACKTEST DATA ===");
console.log(JSON.stringify(fullData[0], null, 2));
console.log("\nUnique keys present in trade objects:", Object.keys(fullData[0]));
