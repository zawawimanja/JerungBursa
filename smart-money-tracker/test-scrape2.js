const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.malaysiastock.biz/Top-Gainers.aspx', {waitUntil: 'domcontentloaded'});
    const html = await page.content();
    fs.writeFileSync('ms_biz.html', html);
    await browser.close();
})();
