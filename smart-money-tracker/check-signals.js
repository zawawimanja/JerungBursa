const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const histDir = './history';
const liveFile = './live_data.json';
const reportFile = './daily_report.txt';

const skipScrape = process.argv.includes('--skip');

if (!skipScrape) {
  console.log('🚀 Running Bursa Smart Money Daily Scraper...');
  try {
    execSync('node scrape-real.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to run scrape-real.js. Proceeding with existing live_data.json...');
  }
} else {
  console.log('⏭️ Skipping scraper, using existing live_data.json...');
}

if (!fs.existsSync(liveFile)) {
  console.error('❌ Error: live_data.json not found!');
  process.exit(1);
}

// 1. Get Live Data
const liveData = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
const liveUpdated = liveData.lastUpdated || new Date().toISOString();
const liveVol = liveData.topVolume || [];
const liveGainers = liveData.topGainers || [];

const liveMap = new Map();
liveVol.forEach(s => liveMap.set(s.name.toUpperCase(), s));
liveGainers.forEach(s => {
  const name = s.name.toUpperCase();
  if (!liveMap.has(name)) {
    liveMap.set(name, s);
  }
});

// 2. Get the latest history file (previous day)
const files = fs.readdirSync(histDir)
  .filter(f => f.startsWith('data_') && f.endsWith('.json'))
  .sort();

let prevMap = new Map();
let prevDate = 'N/A';

if (files.length > 0) {
  const latestFile = files[files.length - 1];
  prevDate = latestFile.replace('data_', '').replace('.json', '');
  const prevData = JSON.parse(fs.readFileSync(path.join(histDir, latestFile), 'utf8'));
  const prevList = Array.isArray(prevData) ? prevData : (prevData.topVolume || []);
  prevList.forEach(s => prevMap.set(s.name.toUpperCase(), s));
}

// 3. Define our active tracking list
const activeTargets = [
  { name: 'ZETRIX', entry: 0.845, category: 'Intraday' },
  { name: 'VS', entry: 0.210, category: 'Intraday' },
  { name: 'TMK', entry: 2.200, category: 'Swing' }
];

let report = `======================================================
📊 LAPORAN SMART MONEY BURSA - ${liveUpdated.split('T')[0]}
======================================================
Masa Kemaskini: ${liveUpdated}
Perbandingan Dengan Tarikh Lepas: ${prevDate}

🏆 PRESTASI WATCHLIST AKTIF:
------------------------------------------------------`;

activeTargets.forEach(t => {
  const liveStock = liveMap.get(t.name);
  const currentPrice = liveStock ? liveStock.price : null;
  
  if (currentPrice !== null) {
    const returnPct = ((currentPrice - t.entry) / t.entry) * 100;
    const sign = returnPct > 0 ? '+' : '';
    let status = 'RUNNING';
    if (returnPct >= 10.0) status = '🎯 TARGET HIT (TP)';
    else if (returnPct <= -5.0) status = '⚠️ CUT LOSS';
    
    report += `\n* ${t.name} (${t.category})
  Harga Entry: RM ${t.entry.toFixed(3)} | Harga Kini: RM ${currentPrice.toFixed(3)}
  Untung/Rugi: ${sign}${returnPct.toFixed(2)}% | Status: [${status}]`;
  } else {
    report += `\n* ${t.name} (${t.category})
  Harga Entry: RM ${t.entry.toFixed(3)} | Harga Kini: N/A (Tiada dalam Top Volume/Gainers hari ini)`;
  }
});

report += `\n\n🎯 FRESH BUY SIGNALS HARI INI (Saham Baru / Bertukar BUY):
------------------------------------------------------`;

let freshSignalsCount = 0;
for (const [name, stock] of liveMap.entries()) {
  if (stock.price >= 5.00) continue; // Sembunyikan saham terlampau mahal
  if (stock.signal !== 'buy') continue;
  
  // Check if it is a fresh BUY signal (was not in prevMap or was AVOID in prevMap)
  const prevStock = prevMap.get(name);
  const isFreshNew = !prevStock;
  const isTransition = prevStock && prevStock.signal !== 'buy';
  
  if (isFreshNew || isTransition) {
    freshSignalsCount++;
    const type = isFreshNew ? 'NEW SCAN' : `TRANSITION (${prevStock.signal.toUpperCase()} -> BUY)`;
    report += `\n* ${name} (RM ${stock.price.toFixed(3)}) [${type}]
  Turnover: RM ${(stock.turnover / 1e6).toFixed(2)}M | Kenaikan: +${(stock.changePct || stock.change || 0).toFixed(2)}%
  Sebab: ${stock.reason}`;
  }
}

if (freshSignalsCount === 0) {
  report += `\n(Tiada isyarat BUY baru dikesan hari ini)`;
}

report += `\n\n======================================================
💡 Sila salin keseluruhan laporan ini & hantar kepada Antigravity
   untuk mendapatkan ulasan portfolio/saranan lanjut.
======================================================`;

// Save report to file
fs.writeFileSync(reportFile, report, 'utf8');

// Print report to console
console.log('\n' + report);
