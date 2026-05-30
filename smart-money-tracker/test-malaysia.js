const axios = require('axios');
const cheerio = require('cheerio');

// The malaysiastock.biz Top Volume page uses ASP.NET UpdatePanel
// We need to first GET the page to get VIEWSTATE tokens, then POST with proper params

async function scrapeTopVolume() {
    const BASE_URL = 'https://www.malaysiastock.biz';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': BASE_URL + '/Top-Volume.aspx',
    };
    
    // Step 1: GET the page to get __VIEWSTATE
    console.log('Step 1: Getting page with VIEWSTATE...');
    const getRes = await axios.get(BASE_URL + '/Top-Volume.aspx', { headers });
    const $ = cheerio.load(getRes.data);
    
    const viewState = $('input[name="__VIEWSTATE"]').val();
    const viewStateGen = $('input[name="__VIEWSTATEGENERATOR"]').val();
    const eventValidation = $('input[name="__EVENTVALIDATION"]').val();
    const toolkitField = $('input[name="ToolkitScriptManager1_HiddenField"]').val() || '';
    
    console.log('VIEWSTATE found:', !!viewState);
    console.log('EVENTVALIDATION found:', !!eventValidation);
    
    // Check if data is already in the page
    const tables = $('table');
    let found = false;
    tables.each((i, el) => {
        const rows = $(el).find('tr');
        if (rows.length > 30) {
            const text = $(el).text();
            if (text.includes('No.') || text.includes('Volume') || text.includes('Price')) {
                console.log(`Table ${i} with ${rows.length} rows - potential stock data:`);
                rows.slice(0, 3).each((j, row) => {
                    console.log('  Row:', $(row).text().replace(/\s+/g, ' ').trim().substring(0, 100));
                });
                found = true;
            }
        }
    });
    
    if (!found) {
        console.log('No stock data in page HTML, trying ASP.NET postback...');
        
        // Step 2: POST with __doPostBack to trigger stock data load
        const postBody = new URLSearchParams({
            'ToolkitScriptManager1_HiddenField': toolkitField,
            '__EVENTTARGET': 'ctl00$ToolkitScriptManager1',
            '__EVENTARGUMENT': '',
            '__VIEWSTATE': viewState || '',
            '__VIEWSTATEGENERATOR': viewStateGen || '',
            '__EVENTVALIDATION': eventValidation || '',
        });
        
        const postRes = await axios.post(BASE_URL + '/Top-Volume.aspx', postBody.toString(), {
            headers: {
                ...headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'X-MicrosoftAjax': 'Delta=true',
            }
        });
        
        console.log('POST response length:', postRes.data.length);
        console.log('Preview:', postRes.data.substring(0, 500));
    }
}

scrapeTopVolume().catch(console.error);
