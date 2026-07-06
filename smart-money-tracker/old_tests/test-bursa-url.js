const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.bursamalaysia.com/market_information/equities_prices?mode=top_gainers', {waitUntil: 'networkidle2'});
    const h3 = await page.evaluate(() => document.querySelector('h3').textContent.trim());
    console.log("Header:", h3);
    await browser.close();
})();
