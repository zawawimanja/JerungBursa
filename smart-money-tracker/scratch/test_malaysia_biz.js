const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    const url = 'https://www.malaysiastock.biz/Top-Volume.aspx';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    try {
        console.log('Fetching', url);
        const res = await axios.get(url, { headers });
        const $ = cheerio.load(res.data);
        console.log('HTML loaded, length:', res.data.length);
        
        // Find all tables and see their rows
        $('table').each((i, table) => {
            const rows = $(table).find('tr');
            if (rows.length > 5) {
                console.log(`Table ${i}: ID=${$(table).attr('id') || ''}, Class=${$(table).attr('class') || ''}, Rows=${rows.length}`);
                // Print first 3 rows
                rows.slice(0, 3).each((j, row) => {
                    console.log(`  Row ${j}:`, $(row).text().replace(/\s+/g, ' ').trim().substring(0, 150));
                });
            }
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
