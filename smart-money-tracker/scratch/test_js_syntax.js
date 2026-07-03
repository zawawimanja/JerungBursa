const fs = require('fs');
const path = require('path');
const vm = require('vm');

try {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    
    // Extract script content
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let scripts = [];
    while ((match = scriptRegex.exec(html)) !== null) {
        const content = match[1];
        if (content.trim()) {
            scripts.push(content);
        }
    }
    
    console.log(`Found ${scripts.length} script blocks. Checking syntax...`);
    
    scripts.forEach((code, idx) => {
        try {
            new vm.Script(code);
            console.log(`Script block ${idx + 1}: Syntax OK!`);
        } catch (e) {
            console.error(`❌ Syntax Error in Script block ${idx + 1}:`, e);
        }
    });
    
} catch (err) {
    console.error("Failed to read index.html", err);
}
