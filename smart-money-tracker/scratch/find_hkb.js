const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../history');

console.log('Searching for HKB in history directory:', historyDir);

if (!fs.existsSync(historyDir)) {
    console.error('Directory does not exist');
    process.exit(1);
}

const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));

files.forEach(file => {
    const filePath = path.join(historyDir, file);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        const list = data.topVolume || [];
        
        // Search inside list (which is an array of objects)
        const found = list.filter(item => {
            const name = item.name || '';
            return name.toUpperCase().includes('HKB') || name.toUpperCase() === 'HKB';
        });
        
        if (found.length > 0) {
            console.log(`\nFound in ${file}:`);
            found.forEach(item => {
                console.log(JSON.stringify(item, null, 2));
            });
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});
