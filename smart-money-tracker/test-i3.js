const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://klse.i3investor.com/jsp/quote/tv.jsp', {waitUntil: 'domcontentloaded', timeout: 30000});
    const tickers = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.nc tr');
        let results = [];
        rows.forEach(r => {
            const a = r.querySelector('a');
            if (a) {
                const text = a.textContent.trim();
                const codeMatch = r.textContent.match(/\((\d{4}[A-Z]*)\)/);
                if (text && codeMatch) {
                    results.push({name: text, code: codeMatch[1]});
                }
            }
        });
        return results;
    });
    console.log(tickers.slice(0, 5));
    await browser.close();
})();
