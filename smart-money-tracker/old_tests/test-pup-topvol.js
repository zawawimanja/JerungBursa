const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('https://www.malaysiastock.biz/Top-Volume.aspx', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Try clicking the "Main Board" tab or waiting for the stock table
    await new Promise(r => setTimeout(r, 5000));
    
    // Save full HTML for analysis
    const html = await page.content();
    require('fs').writeFileSync('topvol_rendered.html', html);
    console.log('Saved topvol_rendered.html, size:', html.length);
    
    // Also search for "MR DIY" or "MYEG" in rendered page
    const hasDIY = html.includes('MR DIY') || html.includes('DIY');
    const hasMyeg = html.includes('MYEG');
    console.log('Has DIY:', hasDIY, 'Has MYEG:', hasMyeg);
    
    // Find all tables in the rendered content
    const tables = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('table')).map((t, i) => ({
            i, id: t.id, cls: t.className, rows: t.rows.length,
            row1: t.rows[1] ? t.rows[1].innerText.replace(/\s+/g, '|').substring(0, 100) : ''
        })).filter(t => t.rows > 5);
    });
    console.log('Tables:', JSON.stringify(tables, null, 2));
    
    await browser.close();
})();
