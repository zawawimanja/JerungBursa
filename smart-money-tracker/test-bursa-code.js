const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.bursamalaysia.com/market_information/equities_prices?mode=top_active', {waitUntil: 'networkidle2'});
    const data = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        let results = [];
        rows.forEach(r => {
            const nameEl = r.querySelector('td:nth-child(2)'); // Stock Name
            const codeEl = r.querySelector('td:nth-child(3)'); // Stock Code
            if(nameEl && codeEl) {
                results.push({
                    name: nameEl.textContent.trim().split(' ')[0],
                    code: codeEl.textContent.trim()
                });
            }
        });
        return results;
    });
    console.log(data.slice(0, 10));
    await browser.close();
})();
