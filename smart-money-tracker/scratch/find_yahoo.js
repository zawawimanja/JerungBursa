const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'history' && file !== 'scratch') {
                searchDir(fullPath);
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.html') || file.endsWith('.md')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.toLowerCase().includes('yahoo') || content.toLowerCase().includes('finance')) {
                    console.log(`Found pattern in ${fullPath}`);
                }
            }
        }
    });
}

searchDir("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker");
