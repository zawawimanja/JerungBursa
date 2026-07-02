const fs = require('fs');
const path = require('path');

const histDir = path.join(__dirname, '../history');
if (!fs.existsSync(histDir)) {
    console.error("❌ History directory not found");
    process.exit(1);
}

const files = fs.readdirSync(histDir)
    .filter(f => f.startsWith('data_') && f.endsWith('.json'))
    .sort();

console.log(`🔍 Menjumpai ${files.length} fail sejarah untuk tag retroactive VVIP...`);

for (let i = 1; i < files.length; i++) {
    const prevFile = files[i - 1];
    const currentFile = files[i];
    
    const prevPath = path.join(histDir, prevFile);
    const currentPath = path.join(histDir, currentFile);
    
    try {
        const prevData = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
        const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
        
        const prevTopVolume = prevData.topVolume || [];
        const prevNames = new Set(prevTopVolume.map(item => item.name.toUpperCase()));
        
        const currentTopVolume = currentData.topVolume || [];
        
        let taggedCount = 0;
        currentTopVolume.forEach(item => {
            if (prevNames.has(item.name.toUpperCase())) {
                item.isVvip = true;
                taggedCount++;
            } else {
                delete item.isVvip; // Ensure clean state
            }
        });
        
        // Save the updated file back
        fs.writeFileSync(currentPath, JSON.stringify(currentData, null, 2), 'utf8');
        console.log(`✅ Berjaya tag ${taggedCount} kaunter VVIP pada fail: ${currentFile} (berdasarkan ${prevFile})`);
    } catch (err) {
        console.error(`❌ Gagal memproses ${currentFile}:`, err.message);
    }
}

console.log(`\n🎉 Proses pembetulan data arkib sejarah selesai!`);
