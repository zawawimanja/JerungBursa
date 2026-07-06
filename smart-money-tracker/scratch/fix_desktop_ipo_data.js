const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';

if (!fs.existsSync(ipoDataPath)) {
    console.error("Desktop data.json does NOT exist!");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

// 1. Fix Cheeding symbol
const cheeding = data.find(item => item.id === 'cheeding');
if (cheeding) {
    console.log("Original Cheeding entry:", JSON.stringify(cheeding, null, 2));
    cheeding.symbol = 'CHEEDING';
    console.log("Updated Cheeding symbol to 'CHEEDING'");
}

// 2. Add or update HEGROUP entry
let hegroup = data.find(item => item.id === 'hegroup' || (item.companyName && item.companyName.toUpperCase().includes('HE GROUP')));
if (hegroup) {
    console.log("Found existing HEGROUP entry:", JSON.stringify(hegroup, null, 2));
    hegroup.id = 'hegroup';
    hegroup.companyName = 'HE Group Berhad';
    hegroup.symbol = 'HEGROUP';
    hegroup.year = 2024;
    hegroup.listingDate = '2024-01-30';
    hegroup.price = 0.28;
} else {
    console.log("HEGROUP entry not found. Adding a new one...");
    hegroup = {
        "id": "hegroup",
        "companyName": "HE Group Berhad",
        "market": "ACE Market",
        "listingDate": "2024-01-30",
        "year": 2024,
        "price": 0.28,
        "symbol": "HEGROUP",
        "predictedGrade": "B",
        "status": "Listed"
    };
    data.push(hegroup);
    console.log("Added HEGROUP:", JSON.stringify(hegroup, null, 2));
}

// Save back
fs.writeFileSync(ipoDataPath, JSON.stringify(data, null, 2), 'utf8');
console.log("Successfully wrote updated data.json back to desktop!");
