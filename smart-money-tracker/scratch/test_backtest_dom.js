const puppeteer = require('puppeteer');
const path = require('path');

async function main() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    const fileUrl = 'file://' + path.resolve(__dirname, '../backtest.html');
    console.log("Loading page:", fileUrl);
    await page.goto(fileUrl, { waitUntil: 'load' });
    
    // Function to get current values from the DOM
    async function getMetrics(label) {
        return await page.evaluate((lbl) => {
            const wr = document.getElementById('vvip-winrate').innerText;
            const ratio = document.getElementById('vvip-ratio').innerText;
            const sl = document.getElementById('vvip-sl-rate').innerText;
            const slRatio = document.getElementById('vvip-sl-ratio').innerText;
            const avg = document.getElementById('vvip-avg-return').innerText;
            const pnl = document.getElementById('vvip-total-pnl').innerText;
            const total = document.getElementById('vvip-total-trades-label').innerText;
            
            const netProfit = document.getElementById('vvip-net-profit').innerText;
            const finalPort = document.getElementById('vvip-final-portfolio').innerText;
            
            return {
                label: lbl,
                winRate: wr,
                ratio: ratio,
                slRate: sl,
                slRatio: slRatio,
                avgReturn: avg,
                totalPnL: pnl,
                totalTrades: total,
                netProfit: netProfit,
                finalPortfolio: finalPort
            };
        }, label);
    }
    
    // Scenario 1: Default (Limit: Top 6, Min Turnover: 750k)
    console.log("\n--- Scenario 1: Limit Top 6, Turnover 750k ---");
    console.log(await getMetrics("Default"));
    
    // Scenario 2: Limit: Top 6, Min Turnover: 1.0M
    console.log("\n--- Scenario 2: Limit Top 6, Turnover 1.0M ---");
    await page.select('#sim-turnover', '1000000');
    await page.evaluate(() => initDashboard());
    console.log(await getMetrics("Top 6 + 1.0M"));
    
    // Scenario 3: Limit: Top 3, Min Turnover: 1.0M
    console.log("\n--- Scenario 3: Limit Top 3, Turnover 1.0M ---");
    await page.select('#sim-limit', 'top3');
    await page.select('#sim-turnover', '1000000');
    await page.evaluate(() => initDashboard());
    console.log(await getMetrics("Top 3 + 1.0M"));

    // Scenario 4: Limit: None, Min Turnover: 1.0M
    console.log("\n--- Scenario 4: Limit None, Turnover 1.0M ---");
    await page.select('#sim-limit', 'none');
    await page.select('#sim-turnover', '1000000');
    await page.evaluate(() => initDashboard());
    console.log(await getMetrics("None + 1.0M"));
    
    await browser.close();
}

main().catch(console.error);
