const fs = require('fs');
const path = require('path');

// 1. Load the corrected database mapping
const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const ipoList = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));
const ipoMap = {};

ipoList.forEach(ipo => {
    if (ipo.symbol) {
        const cleanSymbol = ipo.symbol.replace(/\[.*?\]/g, '').toUpperCase().trim();
        const listingYear = parseInt(ipo.year) || (ipo.listingDate ? parseInt(ipo.listingDate.split('-')[2]) : 0);
        if (listingYear >= 2019) {
            ipoMap[cleanSymbol] = {
                grade: ipo.predictedGrade || 'Unrated',
                year: listingYear,
                ipoPrice: ipo.price,
                shariah: ipo.shariah
            };
        }
    }
});

// Fallbacks matching scrape-real.js
const fallbackIpoMap = {
    '3REN': 'B',
    'HEGROUP': 'B'
};

// 2. Loop through history files and patch them
const historyDir = path.join(__dirname, '../history');
if (!fs.existsSync(historyDir)) {
    console.error("History directory not found!");
    process.exit(1);
}

const files = fs.readdirSync(historyDir).filter(f => f.startsWith('data_') && f.endsWith('.json'));
console.log(`🔍 Found ${files.length} history files to patch...`);

files.forEach(file => {
    const filePath = path.join(historyDir, file);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Check if it's new structure (contains topVolume/processedData) or old flat array
    let isNewStructure = false;
    let list = [];
    
    if (Array.isArray(raw)) {
        list = raw;
    } else if (raw.topVolume) {
        list = raw.topVolume;
        isNewStructure = true;
    }
    
    let patchedCount = 0;
    list.forEach(item => {
        const cleanName = item.name.toUpperCase().trim();
        const info = ipoMap[cleanName];
        if (info) {
            // Apply correct grade, year, and price
            item.ipoGrade = info.grade === 'Unrated' ? (fallbackIpoMap[cleanName] || 'Unrated') : info.grade;
            item.ipoYear = info.year;
            item.ipoPrice = info.ipoPrice;
            item.shariah = info.shariah;
            
            // Apply below-IPO price rule to history as well
            const isFresh = info.year >= 2025;
            if (isFresh && item.ipoPrice && item.price < item.ipoPrice) {
                item.signal = 'avoid';
                item.reason = `⚠️ Below IPO Price: Failed IPO Base (Price RM ${item.price.toFixed(3)} < IPO RM ${item.ipoPrice.toFixed(3)})`;
            }
            
            patchedCount++;
        }
    });
    
    // Save the patched file back
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');
    // console.log(`   - Patched ${patchedCount} IPOs in ${file}`);
});

console.log("✅ All history files patched successfully with correct IPO grades!");
