const fs = require('fs');
const path = require('path');

const targetFiles = [
    path.join(__dirname, '../index.html'),
    path.join(__dirname, '../sop.html'),
    path.join(__dirname, '../backtest.html'),
    path.join(__dirname, '../formula.html')
];

const patterns = [
    { regex: /Teknik\s+C\s*\(Trend\s+Rider\)/gi, replacement: 'Trend Rider' },
    { regex: /Option\s+C\s*\(Trend\s+Rider\)/gi, replacement: 'Trend Rider' },
    { regex: /Teknik[- ]C/gi, replacement: 'Trend Rider' },
    { regex: /Option[- ]C/gi, replacement: 'Trend Rider' }
];

console.log("=== STARTING RENAME PROCESS ===");

targetFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`[SKIP] File does not exist: ${path.basename(filePath)}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    let fileModified = false;
    
    patterns.forEach(p => {
        const matches = content.match(p.regex);
        if (matches) {
            console.log(`[MATCH] Found ${matches.length} matches of ${p.regex} in ${path.basename(filePath)}`);
            content = content.replace(p.regex, p.replacement);
            fileModified = true;
        }
    });
    
    if (fileModified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[SAVED] Updated ${path.basename(filePath)} successfully!`);
    } else {
        console.log(`[NO CHANGE] No matches found in ${path.basename(filePath)}`);
    }
});
console.log("=== RENAME PROCESS COMPLETED ===");
