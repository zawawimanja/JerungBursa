const fs = require('fs');
const path = require('path');

// 1. Load symbol mappings to know which names map to which symbols
const mappingsFile = path.join(__dirname, '../symbol_mappings.json');
const rawMappings = JSON.parse(fs.readFileSync(mappingsFile, 'utf8'));

// Determine the shortest name for each symbol (same logic as scrape-real.js)
const symToNames = {};
for (const [name, sym] of Object.entries(rawMappings)) {
    if (!symToNames[sym]) symToNames[sym] = [];
    symToNames[sym].push(name);
}

const shortestNames = new Set();
for (const [sym, names] of Object.entries(symToNames)) {
    names.sort((a, b) => a.length - b.length);
    shortestNames.add(names[0].toUpperCase());
}

// 2. Loop through history files and remove items that do not use the shortest name
const historyDir = path.join(__dirname, '../history');
const files = fs.readdirSync(historyDir).filter(f => f.startsWith('data_') && f.endsWith('.json'));

console.log(`🧹 Scanning and cleaning duplicates in ${files.length} history files...`);

files.forEach(file => {
    const filePath = path.join(historyDir, file);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let isNewStructure = false;
    let list = [];
    
    if (Array.isArray(raw)) {
        list = raw;
    } else if (raw.topVolume) {
        list = raw.topVolume;
        isNewStructure = true;
    }
    
    const originalLength = list.length;
    
    // Filter the list: keep only if the name matches the shortest name in our mapping, 
    // OR if the name is not in rawMappings at all (like normal Bursa stocks)
    const cleanedList = list.filter(item => {
        const nameUpper = item.name.toUpperCase().trim();
        const mappedSym = rawMappings[nameUpper];
        
        // If it's a VIP stock that has a mapping, only keep it if it is the shortest name (e.g. AMS, not the long one)
        if (mappedSym) {
            return shortestNames.has(nameUpper);
        }
        return true;
    });
    
    const removedCount = originalLength - cleanedList.length;
    
    if (removedCount > 0) {
        if (isNewStructure) {
            raw.topVolume = cleanedList;
        } else {
            // If it was a flat array, write it back
            // (We just reassign raw to cleanedList)
            // But since raw is a const reference, we do:
            fs.writeFileSync(filePath, JSON.stringify(cleanedList, null, 2), 'utf8');
            return;
        }
        fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');
        console.log(`   - Removed ${removedCount} duplicates from ${file}`);
    }
});

console.log("✅ All history files are now 100% deduplicated!");
