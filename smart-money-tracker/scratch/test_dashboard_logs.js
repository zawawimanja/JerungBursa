const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Listen to console events
    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.error(`[BROWSER ERROR] ${err.toString()}`);
    });

    const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');
    console.log(`Opening: ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle2' });

    // Wait a bit to let it load
    await new Promise(resolve => setTimeout(resolve, 3000));

    await browser.close();
})();
