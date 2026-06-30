const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto('https://www.bursamalaysia.com/market_information/equities_prices?mode=top_active', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        await page.waitForSelector('table tbody tr', { timeout: 10000 });
        
        const headers = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('table thead th')).map(th => th.innerText.trim());
        });
        
        const firstRowHTML = await page.evaluate(() => {
            const firstRow = document.querySelector('table tbody tr');
            return firstRow ? firstRow.outerHTML : 'No row found';
        });

        console.log('Headers:', headers);
        console.log('First Row HTML:', firstRowHTML);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
})();
