const axios = require('axios');
const fs = require('fs');
const path = require('path');

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, '../symbol_mappings.json'), 'utf8'));

// List of new candidates from the relaxation test
const candidates = [
    { name: 'ZETRIX', code: '0138' },
    { name: 'OPPSTAR', code: '0275' },
    { name: 'SUNMED', code: '5555' },
    { name: 'ELRIDGE', code: '0318' },
    { name: 'CHEEDING', code: '0372' },
    { name: 'CTOS', code: '5301' },
    { name: 'VSTECS', code: '5162' },
    { name: 'AMS', code: '0399' },
    { name: 'REACHTEN', code: '5332' }
];

async function checkTrueUptrend() {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    
    console.log(`Checking true uptrend status (Price >= SMA50) for the 9 candidates...`);
    console.log('='.repeat(90));
    console.log(`Counter   | Price   | SMA50   | Status SMA    | Pullback | Status Sebenar`);
    console.log('='.repeat(90));
    
    for (const c of candidates) {
        const symbol = `${c.code}.KL`;
        try {
            const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, { headers });
            if (res.data && res.data.chart && res.data.chart.result) {
                const result = res.data.chart.result[0];
                const timestamp = result.timestamp || [];
                const quote = result.indicators.quote[0];
                const close = quote.close || [];
                const high = quote.high || [];
                
                const validDays = [];
                for (let i = 0; i < timestamp.length; i++) {
                    if (close[i] !== null && close[i] !== undefined) {
                        validDays.push({
                            close: close[i],
                            high: high[i]
                        });
                    }
                }
                
                if (validDays.length >= 2) {
                    const currentPrice = validDays[validDays.length - 1].close;
                    
                    // Calculate SMA50
                    const closesDaily = validDays.map(d => d.close);
                    const sma50 = closesDaily.length >= 50
                        ? closesDaily.slice(-50).reduce((a, b) => a + b, 0) / 50
                        : (closesDaily.reduce((a, b) => a + b, 0) / closesDaily.length);
                        
                    // Calculate 52W High
                    let high52 = 0;
                    validDays.forEach(d => { if (d.high > high52) high52 = d.high; });
                    const pullback = ((high52 - currentPrice) / high52) * 100;
                    
                    const isSmaUptrend = currentPrice >= sma50;
                    
                    console.log(
                        `${c.name.padEnd(9)} | ` +
                        `RM ${currentPrice.toFixed(3)} | ` +
                        `RM ${sma50.toFixed(3)} | ` +
                        `${isSmaUptrend ? '🔥 UPTREND   ' : '🧊 DOWNTREND '} | ` +
                        `${pullback.toFixed(2)}%   | ` +
                        `${isSmaUptrend && pullback <= 40 ? '✅ LULUS (Uptrend Rebound)' : '❌ GAGAL (True Downtrend)'}`
                    );
                }
            }
        } catch (e) {
            console.log(`${c.name.padEnd(9)} | Error fetching data: ${e.message}`);
        }
    }
    console.log('='.repeat(90));
}

checkTrueUptrend();
