const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const axios = require('axios');

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
        
        const bursaData = await page.evaluate(() => {
            const row = document.querySelector('table tbody tr');
            if (!row) return null;
            const cols = row.querySelectorAll('td');
            return {
                name: cols[1].innerText.trim(),
                code: cols[2].innerText.trim(),
                price: parseFloat(cols[4].innerText.trim().replace(/,/g, '')),
                volumeText: cols[8].innerText.trim()
            };
        });

        console.log('Bursa scraped first row:', bursaData);
        
        if (bursaData) {
            const ticker = `${bursaData.code}.KL`;
            console.log(`Fetching Yahoo Finance data for ${ticker}...`);
            const yRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`);
            const meta = yRes.data.chart.result[0].meta;
            console.log('Yahoo Finance price:', meta.regularMarketPrice);
            console.log('Yahoo Finance volume:', meta.regularMarketVolume);
            
            const rawBursaVol = parseInt(bursaData.volumeText.replace(/,/g, ''), 10);
            console.log('Raw Bursa volume:', rawBursaVol);
            console.log('Ratio Yahoo Vol / Raw Bursa Vol:', meta.regularMarketVolume / rawBursaVol);
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
})();
