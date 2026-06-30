const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log('Launching browser with system Chrome...');
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('Navigating to i3investor mostactive page...');
        const response = await page.goto('https://klse.i3investor.com/web/market/mostactive', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        console.log('Response status:', response.status());
        const html = await page.content();
        console.log('Page title:', await page.title());
        console.log('HTML length:', html.length);
        
        const hasActiveTab = html.includes('tab-active') || html.includes('Active');
        console.log('Has Active Tab in HTML:', hasActiveTab);
        
        require('fs').writeFileSync('i3_mostactive_pup.html', html);
        console.log('Saved i3_mostactive_pup.html');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
})();
