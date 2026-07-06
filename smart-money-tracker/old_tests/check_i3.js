const fs = require('fs');
const cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('i3_topvol.html'));

// Find the data section
const htmlText = fs.readFileSync('i3_topvol.html', 'utf8');

// Look for AXIATA context
const idx = htmlText.indexOf('AXIATA');
console.log('AXIATA context:');
console.log(htmlText.substring(idx - 200, idx + 500));
