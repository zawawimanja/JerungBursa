const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
    const response = await axios.get('https://klse.i3investor.com/web/market/mostactive', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    
    const $ = cheerio.load(response.data);
    
    // Data is in div.row.value elements
    const results = [];
    
    $('.row.value').each((i, el) => {
        const cols = $(el).find('.col-4');
        if (cols.length >= 3) {
            const name = $(cols[0]).find('strong').text().trim() || $(cols[0]).text().trim();
            const col1Text = $(cols[1]).text().trim(); // Last Price
            const col2Text = $(cols[2]).text().trim(); // Volume
            
            // Try to find price and change in second column
            const spans = $(cols[1]).find('p');
            
            if (name && col1Text) {
                results.push({
                    name,
                    col1: col1Text.replace(/\s+/g, ' '),
                    col2: col2Text.replace(/\s+/g, ' ')
                });
            }
        }
    });
    
    console.log('Found:', results.length);
    console.log(JSON.stringify(results.slice(0, 10), null, 2));
})();
