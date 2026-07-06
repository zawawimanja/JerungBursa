const fs = require('fs');
const path = require('path');

const jsFile = path.join(__dirname, '../live_data.js');
const content = fs.readFileSync(jsFile, 'utf8');

// We evaluate the javascript file content in a sandbox to inspect window.liveData
const sandbox = {};
eval(content.replace('window.liveData =', 'sandbox.liveData ='));

const list = sandbox.liveData.topVolume || [];

console.log("=== INSPECTING LIVE_DATA.JS RAW CONTENTS ===");
console.log(`Last Updated in JS: ${sandbox.liveData.lastUpdated}`);

const targets = ['ISF', 'AMBEST', 'TEAMSTR', 'OXB'];
targets.forEach(name => {
    const item = list.find(s => s.name === name);
    if (item) {
        console.log(`\nFound target: ${name}`);
        console.log(`- Price: RM ${item.price}`);
        console.log(`- Turnover: RM ${item.turnover}`);
        console.log(`- ipoGrade: ${item.ipoGrade}`);
        console.log(`- ipoYear: ${item.ipoYear}`);
        console.log(`- signal: ${item.signal}`);
        console.log(`- reason: ${item.reason}`);
    } else {
        console.log(`\nTarget not found in JS: ${name}`);
    }
});
