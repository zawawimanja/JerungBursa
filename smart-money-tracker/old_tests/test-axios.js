const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const url = 'https://www.bursamalaysia.com/market_information/equities_prices?mode=top_active';
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const rows = $('table tbody tr');
        console.log(`Found ${rows.length} rows`);
        const firstRow = rows.first().find('td:nth-child(2)').text().trim();
        console.log(`First row name: ${firstRow}`);
    } catch (e) {
        console.error(e.message);
    }
}
test();
