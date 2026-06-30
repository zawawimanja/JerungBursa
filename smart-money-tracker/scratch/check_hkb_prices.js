const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
};

async function checkHKB() {
  console.log("Fetching HKB (0359.KL) history from Yahoo Finance Chart API...");
  try {
    const res = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/0359.KL?interval=1d&range=3mo', { headers: HEADERS });
    const chart = res.data.chart.result[0];
    const timestamps = chart.timestamp;
    const indicators = chart.indicators.quote[0];
    
    console.log("Date       | Open  | High  | Low   | Close | Volume");
    console.log("--------------------------------------------------");
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      const open = indicators.open[i];
      const high = indicators.high[i];
      const low = indicators.low[i];
      const close = indicators.close[i];
      const volume = indicators.volume[i];
      if (date >= '2026-06-01' && date <= '2026-06-30') {
        console.log(`${date} | ${open ? open.toFixed(3) : 'N/A'} | ${high ? high.toFixed(3) : 'N/A'} | ${low ? low.toFixed(3) : 'N/A'} | ${close ? close.toFixed(3) : 'N/A'} | ${volume ? volume.toLocaleString() : 'N/A'}`);
      }
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

checkHKB();
