const fs = require('fs');

const pathJerungLive = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const pathIpoData = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\ipo\\data.json";

console.log('=== Checking live_data.json ===');
if (fs.existsSync(pathJerungLive)) {
    const live = JSON.parse(fs.readFileSync(pathJerungLive, 'utf8'));
    console.log('Keys in live_data:', Object.keys(live).slice(0, 10));
    // Let's find some tickers like EIPOWER, MMCS, SRKK
    const tickers = ['EIPOWER', 'MMCS', 'SRKK', 'STRATUS', 'RTECH'];
    for (const tick of tickers) {
        if (live[tick]) {
            console.log(`\nTicker: ${tick}`);
            const data = live[tick];
            // If it's an array, show length and some elements
            if (Array.isArray(data)) {
                console.log(`Array length: ${data.length}`);
                console.log('Last 2 entries:', data.slice(-2));
            } else {
                console.log('Data:', JSON.stringify(data).substring(0, 300));
            }
        } else {
            // Case insensitive search
            const matchKey = Object.keys(live).find(k => k.toLowerCase() === tick.toLowerCase());
            if (matchKey) {
                console.log(`\nTicker matched: ${matchKey}`);
                const data = live[matchKey];
                if (Array.isArray(data)) {
                    console.log(`Array length: ${data.length}`);
                    console.log('Last 2 entries:', data.slice(-2));
                } else {
                    console.log('Data:', JSON.stringify(data).substring(0, 300));
                }
            } else {
                console.log(`\nTicker: ${tick} NOT FOUND in live_data`);
            }
        }
    }
} else {
    console.log('live_data.json not found');
}

console.log('\n=== Checking ipo/data.json ===');
if (fs.existsSync(pathIpoData)) {
    const ipo = JSON.parse(fs.readFileSync(pathIpoData, 'utf8'));
    console.log('Number of IPO entries:', ipo.length);
    // Find matching ids/companyName
    const searchTerms = ['stratus', 'mmcs', 'srkk', 'eipower', 'power'];
    ipo.forEach(entry => {
        const match = searchTerms.find(term => {
            return entry.id.toLowerCase().includes(term) || entry.companyName.toLowerCase().includes(term);
        });
        if (match) {
            console.log(`Found: ${entry.id} | ${entry.companyName} | Sector: ${entry.sector} | Price: ${entry.price} | Year: ${entry.year} | Status: ${entry.status}`);
        }
    });
} else {
    console.log('ipo/data.json not found');
}
