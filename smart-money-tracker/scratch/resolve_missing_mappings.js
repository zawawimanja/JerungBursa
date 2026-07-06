const fs = require('fs');
const path = require('path');
const axios = require('axios');

const MAPPING_FILE = path.join(__dirname, '../symbol_mappings.json');
const getIpoDataPath = () => {
    const candidatePaths = [
        path.join(__dirname, '../../../ipo/data.json'),
        path.join(__dirname, '../../../ipohunterv2/data.json'),
        '/home/awi/Desktop/ipohunterv2/data.json',
        'C:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/ipo/data.json'
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) return p;
    }
    return candidatePaths[0];
};
const IPO_DATA_PATH = getIpoDataPath();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log('Resolving missing mappings...');
    let mappings = {};
    if (fs.existsSync(MAPPING_FILE)) {
        mappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    }
    
    if (!fs.existsSync(IPO_DATA_PATH)) {
        console.error('IPO data file not found');
        return;
    }
    
    const ipos = JSON.parse(fs.readFileSync(IPO_DATA_PATH, 'utf8'));
    const listed = ipos.filter(x => x.stage === 5 || x.status === "Listed");
    
    console.log(`Listed IPO count: ${listed.length}`);
    
    let resolvedCount = 0;
    for (const ipo of listed) {
        let name = ipo.companyName.toUpperCase().trim();
        // Remove BERHAD or BHD or [NS] suffix for better searching
        const searchName = name.replace(/\bBERHAD\b/gi, '').replace(/\bBHD\b/gi).replace(/\[NS\]/gi, '').trim();
        const symbol = ipo.symbol ? ipo.symbol.toUpperCase().trim() : '';
        const searchSymbol = symbol.replace(/\[NS\]/gi, '').trim();
        
        // Clean name to use as key in symbol_mappings.json
        const cleanName = searchSymbol || searchName;
        
        if (mappings[cleanName]) {
            continue; // Already mapped
        }
        
        console.log(`Searching for: ${cleanName} (searchName: "${searchName}", searchSymbol: "${searchSymbol}")`);
        
        // Try searching by symbol first, then searchName
        const queries = [searchSymbol, searchName, `${searchName} KL`].filter(q => q && q.length >= 2);
        let resolved = false;
        
        for (const q of queries) {
            try {
                await sleep(200);
                const response = await axios.get(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const quotes = response.data.quotes || [];
                const bursaQuote = quotes.find(quote => quote.exchange === 'KLS');
                if (bursaQuote) {
                    mappings[cleanName] = bursaQuote.symbol;
                    console.log(`✅ Success: Resolved "${cleanName}" -> ${bursaQuote.symbol}`);
                    resolved = true;
                    resolvedCount++;
                    
                    // Write mappings immediately to protect progress
                    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mappings, null, 2), 'utf8');
                    break;
                }
            } catch (e) {
                // Ignore query failure, try next query
            }
        }
        
        if (!resolved) {
            console.log(`❌ Failed to resolve: ${cleanName}`);
        }
    }
    
    console.log(`Done! Resolved ${resolvedCount} new symbols.`);
}

main().catch(console.error);
