const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
    try {
        const response = await axios.get('https://www.klsescreener.com/v2/', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ = cheerio.load(response.data);
        
        let results = [];
        // The main page has several tables. Let's find the one for "Top Active" or "Volume"
        // Usually it's in a panel or table
        $('.table-responsive table tbody tr').each((i, el) => {
            const name = $(el).find('a').attr('title');
            const code = $(el).find('a').attr('href');
            if (name && code && code.includes('/v2/stocks/view/')) {
                const symbolCode = code.split('/').pop();
                results.push({ name, symbol: symbolCode + '.KL' });
            }
        });
        
        console.log("Counters Found on Main Page:", results.length);
        console.log(results.slice(0, 10));
    } catch (e) {
        console.log("Error:", e.message);
    }
})();
