const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, 'symbol_mappings.json'), 'utf8'));
const todayData = JSON.parse(fs.readFileSync(path.join(__dirname, 'history', 'data_2026-06-23.json'), 'utf8'));
const list = todayData.topVolume || [];

async function checkAllTrends() {
    console.log('==================================================');
    console.log('📊 ANALYSIS: PRICE VS SMA 20 & SMA 50');
    console.log('==================================================');
    
    for (const item of list) {
        const symbol = mappings[item.name];
        if (!symbol) continue;
        
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
            const res = await axios.get(url, { headers: HEADERS });
            const result = res.data.chart.result[0];
            const closes = result.indicators.quote[0].close.filter(c => c !== null && c !== undefined);
            
            const currentPrice = closes[closes.length - 1];
            const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
            const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
            
            const vsSma20 = ((currentPrice - sma20) / sma20) * 100;
            const vsSma50 = ((currentPrice - sma50) / sma50) * 100;
            
            console.log(`${item.name.padEnd(10)} | Price: RM ${currentPrice.toFixed(3)} | vs SMA20: ${vsSma20.toFixed(2)}% | vs SMA50: ${vsSma50.toFixed(2)}% | Setup: ${item.setupName} | Signal: ${item.signal}`);
        } catch (e) {
            // ignore
        }
    }
}

checkAllTrends();
