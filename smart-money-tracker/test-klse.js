const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.klsescreener.com/v2/screener/top_volume', {waitUntil: 'domcontentloaded'});
    const data = await page.evaluate(() => {
        let results = [];
        const rows = document.querySelectorAll('tr.list-group-item');
        rows.forEach(r => {
            const nameEl = r.querySelector('a[title]');
            const codeEl = r.querySelector('.code');
            
            // Extract text from the row text content or title
            // KLSEScreener usually has sector info in title or near name
            const sectorEl = r.querySelector('.sector');
            const priceEl = r.querySelector('td:nth-child(2)'); // Adjust selector based on table
            
            if(nameEl && codeEl) {
                results.push({
                    name: nameEl.textContent.trim(), 
                    code: codeEl.textContent.trim(),
                    rawText: r.innerText.replace(/\n/g, ' ')
                });
            }
        });
        return results;
    });
    console.log("Found:", data.length);
    console.log(data.slice(0, 3));
    await browser.close();
})();
