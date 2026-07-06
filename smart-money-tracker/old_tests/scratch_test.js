const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function check() {
    try {
        console.log('🌐 Fetching active list...');
        const res = await axios.get('https://klse.i3investor.com/web/market/mostactive', { headers: HEADERS });
        const $ = cheerio.load(res.data);
        
        const stocks = [];
        $('#tab-active .row.value').each((i, el) => {
            const cols = $(el).find('div[class*="col-"]');
            if (cols.length >= 4) {
                const name = $(cols[0]).find('strong').text().trim();
                const priceText = $(cols[1]).find('strong').text().trim();
                const href = $(cols[0]).find('a').attr('href');
                
                let code = '';
                if (href) {
                    const match = href.match(/\/overview\/(\d+)/);
                    if (match) {
                        code = match[1];
                    }
                }
                
                stocks.push({ name, priceText, href, code });
            }
        });
        
        console.log('Parsed first 10 active stocks:');
        console.log(stocks.slice(0, 10));
        
        // Let's test calling Yahoo Finance for one of them
        if (stocks.length > 0) {
            const testStock = stocks.find(s => s.code) || stocks[0];
            if (testStock.code) {
                console.log(`\nTesting Yahoo Finance for ${testStock.name} (${testStock.code}.KL)...`);
                const yRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${testStock.code}.KL?interval=1d&range=1d`, { headers: HEADERS });
                const meta = yRes.data.chart.result[0].meta;
                console.log('Yahoo Finance regularMarketPrice:', meta.regularMarketPrice);
                console.log('Yahoo Finance fiftyTwoWeekHigh:', meta.fiftyTwoWeekHigh);
            }
        }
    } catch(e) {
        console.error('Error:', e.message);
    }
}
check();
