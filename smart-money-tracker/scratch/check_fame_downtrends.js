const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const fameHtmlPath = path.join(__dirname, '../hall-of-fame.html');
const liveDataPath = path.join(__dirname, '../live_data.json');

if (!fs.existsSync(fameHtmlPath) || !fs.existsSync(liveDataPath)) {
    console.error("Files not found!");
    process.exit(1);
}

const html = fs.readFileSync(fameHtmlPath, 'utf8');
const raw = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.topVolume || []);

const $ = cheerio.load(html);
console.log("=== HALL OF FAME CANDIDATES IN CURRENT DATA ===");
console.log("--------------------------------------------------------------------------------------------------");
console.log("No. | Stock   | Price   | setupName            | Signal  | isCombStock | SMA50   | SMA200");
console.log("--------------------------------------------------------------------------------------------------");

$('tr.tr-epic, tr.tr-rare, tr.tr-legend').each((i, el) => {
    const name = $(el).find('td.col-counter a').text().trim().replace(/🔗/g, '').trim();
    const rank = $(el).find('td:first-child').text().trim();
    
    const stock = list.find(s => s.name.toUpperCase().trim() === name.toUpperCase());
    if (stock) {
        console.log(
            `${rank.padEnd(3)} | ${name.padEnd(7)} | RM ${stock.price.toFixed(3)} | ${(stock.setupName || 'N/A').padEnd(20)} | ${(stock.signal || 'avoid').toUpperCase().padEnd(7)} | ${stock.isCombStock} | ${stock.sma50 ? stock.sma50.toFixed(3) : 'N/A'} | ${stock.sma200 ? stock.sma200.toFixed(3) : 'N/A'}`
        );
    } else {
        console.log(`${rank.padEnd(3)} | ${name.padEnd(7)} | NOT IN CURRENT LIVE DATA`);
    }
});
console.log("--------------------------------------------------------------------------------------------------");
