const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.bursamalaysia.com/market_information/equities_prices?mode=top_gainers', {waitUntil: 'domcontentloaded'});
    const html = await page.evaluate(() => document.querySelector('table').innerHTML);
    fs.writeFileSync('bursa_table.html', html);
    await browser.close();
})();
