const fs = require('fs');
const path = require('path');

// Let's scan scratch and base folder for simulator scripts
const dirs = [
    path.join(__dirname, '../'),
    path.join(__dirname, '')
];

console.log("=== SEARCHING FOR STOP LOSS SIMULATION LOGIC ===");

// We will find any script containing 'stopLoss' or 'SL' calculations in the backtest logic
const files = [
    'c:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/JerungBursa/smart-money-tracker/scratch/simulate_top3_backtest.js',
    'c:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/JerungBursa/smart-money-tracker/scratch/run_historical_simulation.js'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`\n📄 Inspecting: ${path.basename(file)}`);
        const content = fs.readFileSync(file, 'utf8').split('\n');
        
        let found = false;
        for (let i = 0; i < content.length; i++) {
            if (content[i].includes('stopLoss') || content[i].includes('SL') || content[i].includes('cutLoss') || content[i].includes('0.9')) {
                if (content[i].includes('price') || content[i].includes('entry') || content[i].includes('floor')) {
                    found = true;
                    console.log(`  Line ${i+1}: ${content[i].trim()}`);
                    // Print surrounding context
                    const start = Math.max(0, i - 2);
                    const end = Math.min(content.length - 1, i + 5);
                    for (let j = start; j <= end; j++) {
                        console.log(`    [${j+1}] ${content[j]}`);
                    }
                    i = end; // Skip printed lines
                }
            }
        }
        if (!found) console.log("  No explicit SL calculations found.");
    }
});
