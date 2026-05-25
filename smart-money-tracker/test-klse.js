const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.klsescreener.com/v2/screener/top_gainers', {waitUntil: 'domcontentloaded'});
    const data = await page.evaluate(() => {
        let results = [];
        const rows = document.querySelectorAll('tr[class="list-group-item"]');
        rows.forEach(r => {
            const codeEl = r.querySelector('.code');
            const nameEl = r.querySelector('a');
            if(codeEl && nameEl) {
                results.push({name: nameEl.textContent.trim(), code: codeEl.textContent.trim()});
            }
        });
        return results;
    });
    console.log("Found:", data.length);
    console.log(data.slice(0, 5));
    await browser.close();
})();
