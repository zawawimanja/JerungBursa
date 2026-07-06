const fs = require('fs');
const path = require('path');

const ipoDataPath = 'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json';
const data = JSON.parse(fs.readFileSync(ipoDataPath, 'utf8'));

console.log("=== NON-SHARIAH LISTED IPOS IN DATABASE ===");
const nonShariah = data.filter(r => r.status === 'Listed' && r.shariah === false);

nonShariah.forEach(r => {
    console.log(`- ${r.companyName} (${r.symbol || 'No Symbol'}) | Listed: ${r.listingDate} | Price: RM ${r.price} | Shariah: ${r.shariah}`);
});
