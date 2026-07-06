const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.bursamalaysia.com/market_information/equities_prices?mode=top_active', {waitUntil: 'domcontentloaded'});
    const html = await page.content();
    console.log(html.includes('GREATEC'));
    const tickers = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        let results = [];
        rows.forEach(r => {
            const td = r.querySelector('td:nth-child(2)');
            if(td) results.push(td.textContent.trim());
        });
        return results;
    });
    console.log(tickers.slice(0, 10));
    await browser.close();
})();
