const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../history');
const files = fs.readdirSync(historyDir)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

console.log(`🔍 Bilangan Kaunter Consolidation Aktif (Bukan Downtrend):`);
for (const file of files) {
    const filePath = path.join(historyDir, file);
    const dataObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const list = dataObj.topVolume || dataObj.data || [];
    const dateStr = file.replace('data_', '').replace('.json', '');
    
    const consolidations = list.filter(item => 
        item.isConsolidation && 
        item.setupName && 
        !item.setupName.includes('Downtrend') && 
        !item.setupName.includes('Avoid')
    );
    
    console.log(`  📅 ${dateStr} | Jumlah Saham: ${list.length} | Consolidation: ${consolidations.length} (${consolidations.map(c => c.name).join(', ')})`);
}
