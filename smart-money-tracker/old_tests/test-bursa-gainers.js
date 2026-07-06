const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.bursamalaysia.com/market_information/equities_prices?mode=top_gainers', {waitUntil: 'domcontentloaded'});
    const tickers = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        let results = [];
        rows.forEach(r => {
            const td = r.querySelector('th'); // the symbol is in th or td?
            const symbolCell = r.querySelector('td:nth-child(2)');
            const codeCell = r.querySelector('td:nth-child(3)'); // let's check code
            if(symbolCell && codeCell) {
                let name = symbolCell.textContent.trim().split(' ')[0]; // ZETRIX [S] -> ZETRIX
                let code = codeCell.textContent.trim();
                results.push({name, code});
            }
        });
        return results;
    });
    console.log(tickers.slice(0, 5));
    await browser.close();
})();
