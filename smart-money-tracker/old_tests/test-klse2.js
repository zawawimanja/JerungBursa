const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.klsescreener.com/v2/screener/top_gainers', {waitUntil: 'domcontentloaded'});
    const html = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('klse_html.html', html);
    await browser.close();
})();
