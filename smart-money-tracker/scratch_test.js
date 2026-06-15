const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
    try {
        const res = await axios.get('https://klse.i3investor.com/web/stock/listing', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const rows = $('table tbody tr');
        console.log('Found rows:', rows.length);
        
        // Print first 5
        rows.slice(0, 5).each((i, el) => {
            const name = $(el).find('td').eq(0).text().trim();
            const code = $(el).find('td').eq(1).text().trim();
            console.log(name, code);
        });
    } catch(e) {
        console.error(e.message);
    }
}
check();
