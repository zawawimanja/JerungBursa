const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../history');
const files = fs.readdirSync(historyDir)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

console.log(`🔍 MEMERIKSA RAW METRICS BAGI KEEMING DALAM SEJARAH:`);

for (const file of files) {
    const filePath = path.join(historyDir, file);
    const dataObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const list = dataObj.topVolume || dataObj.data || [];
    const dateStr = file.replace('data_', '').replace('.json', '');
    
    const keeming = list.find(item => item.name === 'KEEMING');
    if (keeming) {
        console.log(`  📅 ${dateStr} | Harga: RM ${keeming.price.toFixed(3)} | Pullback: ${keeming.pullback}% | CloseTight: ${keeming.closeTightness}% | TouchCount: ${keeming.touchCount}x | setupName: ${keeming.setupName} | isConsolidation: ${keeming.isConsolidation}`);
    }
}
