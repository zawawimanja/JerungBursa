const fs = require('fs');
const glob = require('glob'); // wait, let's just do fs.readdirSync or recursive scan since we don't have glob imported directly

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = dir + '/' + file;
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'history' && file !== 'scratch') {
                searchDir(fullPath);
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.html') || file.endsWith('.md')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('SRKK')) {
                    console.log(`Found SRKK in ${fullPath}`);
                }
            }
        }
    });
}

searchDir("c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa");
