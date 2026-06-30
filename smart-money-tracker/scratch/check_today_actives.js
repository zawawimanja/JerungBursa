const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../live_data.json');
if (!fs.existsSync(filePath)) {
    console.log("❌ Fail live_data.json tidak dijumpai.");
    process.exit(1);
}

const dataObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const list = dataObj.topVolume || dataObj.data || [];

console.log(`🔍 MENYEMAK KAUNTER AKTIF EMAS (SOP DAILY 1D) PADA ${dataObj.lastUpdated || 'TUTUP HARI INI'}:`);

const activeSetups = [];

for (const item of list) {
    const floor = item.floorLow || (item.price * 0.97);
    const dist = parseFloat((((item.price - floor) / floor) * 100).toFixed(2));
    const isDowntrend = item.setupName && (
        item.setupName.includes('Downtrend') || 
        item.setupName.includes('Avoid') || 
        item.setupName === 'N/A'
    );
    
    // Check if it fits the active Golden Setup criteria:
    if (item.isConsolidation && 
        item.signal === 'buy' && 
        !isDowntrend && 
        item.price <= 3.00 && 
        item.touchCount >= 3 && 
        dist <= 3.0) {
        
        activeSetups.push({
            name: item.name,
            sector: item.sector,
            price: item.price,
            floor: floor,
            touches: item.touchCount,
            dist: dist,
            hasLowerWickRejection: item.hasLowerWickRejection
        });
    }
}

if (activeSetups.length > 0) {
    activeSetups.forEach((s, idx) => {
        const wickTag = s.hasLowerWickRejection ? '🧬 REJECT EKOR (SOP MUTLAK)' : '⚠️ TIADA REJECT EKOR';
        console.log(`#${idx + 1} ${s.name}`);
        console.log(`   Sektor: ${s.sector}`);
        console.log(`   Status: ${wickTag}`);
        console.log(`   Harga Tutup: RM ${s.price.toFixed(3)}`);
        console.log(`   Lantai Sokongan: RM ${s.floor.toFixed(3)}`);
        console.log(`   Sentuhan Lantai: ${s.touches}x`);
        console.log(`   Jarak ke Lantai: +${s.dist.toFixed(2)}%`);
        console.log(`   SL (3% dari Lantai): RM ${(s.floor * 0.97).toFixed(3)}`);
        console.log('----------------------------------------------------');
    });
} else {
    console.log("❌ Tiada kaunter yang memenuhi kriteria sepenuhnya hari ini.");
}
