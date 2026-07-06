const fs = require('fs');
const cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('malaysia_pup.html'));

$('table').each((i, el) => {
    const rows = $(el).find('tr');
    if (rows.length > 20) {
        console.log('Table', i, 'class:', $(el).attr('class'), 'id:', $(el).attr('id'), 'rows:', rows.length);
        
        // Print first two rows
        rows.slice(0, 2).each((j, row) => {
            console.log('  Row', j, $(row).text().replace(/\s+/g, ' ').trim());
        });
    }
});
