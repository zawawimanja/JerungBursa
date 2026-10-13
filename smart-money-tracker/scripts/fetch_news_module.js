const https = require('https');
const cheerio = require('cheerio');
const corporateRisk = require('./lib/corporate_risk');

function fetchUrl(url, { timeoutMs = 5000, requestImpl = https.get } = {}) {
    return new Promise((resolve) => {
        let req;
        let settled = false;
        const finish = result => {
            if (settled) return;
            settled = true;
            clearTimeout(deadline);
            resolve(result);
        };
        const expire = () => {
            finish({ status: 408, error: 'Timeout', data: '' });
            if (req) req.destroy();
        };
        // Socket timeouts reset on each chunk; the absolute deadline also bounds a drip-fed response.
        const deadline = setTimeout(expire, timeoutMs);
        try { req = requestImpl(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: timeoutMs
        }, res => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => finish({ status: res.statusCode, data }));
            res.on('error', err => finish({ status: 500, error: err.message, data: '' }));
            res.on('aborted', () => finish({ status: 502, error: 'Response aborted', data: '' }));
        });
        req.on('error', err => finish({ status: 500, error: err.message, data: '' }));
        req.on('timeout', expire);
        } catch (error) { finish({ status: 500, error: error.message, data: '' }); }
    });
}

const textOf = element => element.text().replace(/\s+/g, ' ').trim();

function parseAnnouncements(html, reference = new Date()) {
    if (typeof html !== 'string') throw new Error('Invalid announcements HTML');
    if (!html.trim()) throw new Error('Empty announcements HTML');
    const $ = cheerio.load(html);
    const announcements = [];
    $('.announcement-item').each((_, item) => {
        const block = $(item);
        const date = `${textOf(block.find('.day'))} ${textOf(block.find('.month'))} ${textOf(block.find('.year'))}`.trim();
        const title = textOf(block.find('.title'));
        if (date && title) {
            if (!corporateRisk.parseEventDate(date, reference, { pastOnly: true })) throw new Error(`Invalid announcement date: ${date}`);
            announcements.push({ date, category: textOf(block.find('.category-tag')), title });
        }
    });
    if (!announcements.length) {
        $('tr').each((_, row) => {
            const tds = $(row).find('td').map((__, cell) => textOf($(cell))).get();
            if (tds.length >= 2 && corporateRisk.parseEventDate(tds[0], reference, { pastOnly: true })) {
                announcements.push({ date: tds[0], category: tds[1], title: tds[2] || tds[1] });
            }
        });
    }
    if (!announcements.length && !/\bno\s+(?:announcements?|records?|data|results?)\b/i.test($.text())) {
        throw new Error('Unrecognized announcements markup');
    }
    return corporateRisk.normalizeAnnouncements(announcements.slice(0, 40), reference, { descending: true });
}

function parseEntitlements(html, reference = new Date()) {
    if (typeof html !== 'string' || !html.trim()) throw new Error('Invalid stock overview HTML');
    const $ = cheerio.load(html);
    const dividends = $('#dividends');
    if (!dividends.length) throw new Error('Dividends section is missing');
    // The old fixed-length substring also consumed the following shareholder table.
    const table = dividends.is('table') ? dividends : dividends.find('table').first();
    if (!table.length && !/\bno\s+(?:dividends?|entitlements?|records?|data|results?)\b/i.test(textOf(dividends))) {
        throw new Error('Dividends table is missing');
    }
    const entitlements = [];
    table.find('tr').each((_, row) => {
        const tds = $(row).find('td').map((__, cell) => textOf($(cell))).get();
        if (tds.length < 4) return;
        const [annDate, financialYear, type, exDate, paymentDate = '', amount = ''] = tds;
        const parsed = corporateRisk.parseEventDate(exDate, reference);
        if (!parsed) {
            if (/ex[ -]?date|ann\.? date/i.test(exDate) || exDate === '-' || !exDate) return;
            throw new Error(`Invalid entitlement ex-date: ${exDate}`);
        }
        entitlements.push({
            annDate, financialYear, type, exDate: parsed.toISOString().slice(0, 10), paymentDate, amount,
            isDividend: /\b(?:dividend|interim|final|special|distribution)\b/i.test(type)
        });
    });
    return entitlements.slice(0, 5);
}

async function fetchAnnouncements(code, { fetchImpl = fetchUrl, reference = new Date() } = {}) {
    const res = await fetchImpl(`https://www.klsescreener.com/v2/announcements/stock/${encodeURIComponent(code)}`);
    if (res.status !== 200 || !res.data) throw new Error(`Announcements fetch failed (${res.status})`);
    const json = JSON.parse(res.data);
    if (!json || typeof json.html !== 'string') throw new Error('Announcements response has no HTML');
    return parseAnnouncements(json.html, reference);
}

async function fetchEntitlements(code, { fetchImpl = fetchUrl, reference = new Date() } = {}) {
    const res = await fetchImpl(`https://www.klsescreener.com/v2/stocks/view/${encodeURIComponent(code)}`);
    if (res.status !== 200 || !res.data) throw new Error(`Entitlements fetch failed (${res.status})`);
    return parseEntitlements(res.data, reference);
}

async function getCorporateNewsRisk(stockCode, stockName, options = {}) {
    if (!stockCode) throw new Error('Stock code is required for corporate news');
    const results = await Promise.allSettled([fetchAnnouncements(stockCode, options), fetchEntitlements(stockCode, options)]);
    const risk = corporateRisk.buildCorporateNewsRisk(
        results[0].status === 'fulfilled' ? results[0].value : [],
        results[1].status === 'fulfilled' ? results[1].value : [],
        options.reference
    );
    risk.fetchStatus = {
        announcements: results[0].status === 'fulfilled' ? 'ok' : 'error',
        entitlements: results[1].status === 'fulfilled' ? 'ok' : 'error'
    };
    return risk;
}

module.exports = { ...corporateRisk, getCorporateNewsRisk, fetchAnnouncements, fetchEntitlements, parseAnnouncements, parseEntitlements, fetchUrl };
