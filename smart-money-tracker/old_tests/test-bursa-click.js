const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.bursamalaysia.com/market_information/equities_prices', {waitUntil: 'networkidle2'});
    
    await page.evaluate(() => {
        // Change the select dropdown to 'top_gainers' and trigger change
        const select = document.querySelector('select[name="mode"]');
        if (select) {
            select.value = 'top_gainers';
            select.dispatchEvent(new Event('change'));
        }
    });
    
    // wait for network idle or 3 seconds
    await new Promise(r => setTimeout(r, 3000));
    
    const data = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        let results = [];
        rows.forEach(r => {
            const nameEl = r.querySelector('td:nth-child(2)');
            const codeEl = r.querySelector('td:nth-child(3)');
            if(nameEl && codeEl) {
                results.push(nameEl.textContent.trim().split(' ')[0]);
            }
        });
        return results;
    });
    console.log(data.slice(0, 10));
    await browser.close();
})();
