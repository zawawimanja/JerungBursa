const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
    try {
        const { data } = await axios.get('https://www.klsescreener.com/v2/stocks/view/0208', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ = cheerio.load(data);
        const priceSection = $('#price').parent().parent().html();
        console.log(priceSection);
    } catch (e) {
        console.error("Error:", e.message);
    }
})();
