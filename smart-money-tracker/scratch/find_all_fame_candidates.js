const fs = require('fs');
const path = require('path');

const liveDataPath = path.join(__dirname, '../live_data.json');
const raw = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.topVolume || []);

// Reconstruct ipoPrice mapping from scrape-real.js:
const ipoPriceMap = {
    "MNHLDG": 0.210,
    "KEEMING": 0.380,
    "HKB": 0.160,
    "AMBEST": 0.250,
    "ICENTS": 0.240,
    "DNEX": 0.200,
    "SUM": 0.280,
    "AMS": 0.290,
    "MMCS": 0.220,
    "YEWLEE": 0.280,
    "SFPTECH": 0.300,
    "ELSA": 0.230,
    "WENTEL": 0.260,
    "CNERGEN": 0.580,
    "UMC": 0.320,
    "KEYFIELD": 0.900,
    "SDCG": 0.580,
    "KTI": 0.300,
    "3REN": 0.280,
    "GOHUB": 0.350,
    "HEGROUP": 0.280,
    "EIPOWER": 0.250,
    "NE": 0.200
};

const candidates = [];

data.forEach(item => {
    const cleanName = item.name.toUpperCase().trim();
    const foundKey = Object.keys(ipoPriceMap).find(key => cleanName.includes(key));
    if (foundKey) {
        const ipoPrice = ipoPriceMap[foundKey];
        const returnPct = ((item.price - ipoPrice) / ipoPrice) * 100;
        candidates.push({
            name: foundKey,
            fullName: item.name,
            price: item.price,
            ipoPrice: ipoPrice,
            returnPct: returnPct,
            pullback: item.pullback,
            turnover: item.turnover
        });
    }
});

candidates.sort((a, b) => b.returnPct - a.returnPct);

console.log("=== CANDIDATES FOR HALL OF FAME ===");
candidates.forEach((c, index) => {
    console.log(`${index + 1}. ${c.name} - Price: RM ${c.price.toFixed(3)} | IPO: RM ${c.ipoPrice.toFixed(3)} | Return: +${c.returnPct.toFixed(2)}% | Pullback: -${(c.pullback || 0).toFixed(1)}%`);
});
