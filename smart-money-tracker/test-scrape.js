const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.malaysiastock.biz/Top-Gainers.aspx', {waitUntil: 'domcontentloaded'});
    const gainers = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.marketInfo tr');
        let results = [];
        rows.forEach(r => {
            const a = r.querySelector('a');
            if (a && a.textContent) {
                results.push(a.textContent.trim());
            }
        });
        return results;
    });
    console.log(gainers.slice(0, 30));
    await browser.close();
})();
