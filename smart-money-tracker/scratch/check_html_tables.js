const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../index.html');
const html = fs.readFileSync(file, 'utf8');

// Find all elements with class table or table-wrapper or id containing table
const cheerio = require('cheerio');
const $ = cheerio.load(html);

console.log("=== TABLES FOUND IN index.html ===");
$('table').each((i, el) => {
    const id = $(el).attr('id') || '';
    const tbodyId = $(el).find('tbody').attr('id') || '';
    console.log(`Table #${i+1}: ID="${id}" | Tbody ID="${tbodyId}"`);
    console.log("Headers:");
    $(el).find('th').each((j, th) => {
        console.log(`  - ${$(th).text().trim()}`);
    });
});

console.log("\n=== TABS FOUND ===");
$('.tabs-nav, .tab-btn').each((i, el) => {
    console.log(`Tab Element: class="${$(el).attr('class')}" text="${$(el).text().trim()}"`);
});
