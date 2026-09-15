const https = require('https');

/**
 * Helper to fetch HTTPS URL content cleanly
 */
function fetchUrl(url) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', err => resolve({ status: 500, error: err.message, data: '' }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 408, error: 'Timeout', data: '' }); });
    });
}

function cleanHtmlText(str) {
    if (!str) return '';
    return str.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Parses raw announcements from KLSE Screener AJAX API
 */
async function fetchAnnouncements(code) {
    const url = `https://www.klsescreener.com/v2/announcements/stock/${code}`;
    const res = await fetchUrl(url);
    if (res.status !== 200 || !res.data) return [];

    try {
        const json = JSON.parse(res.data);
        if (!json || !json.html) return [];

        const announcements = [];
        const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let match;
        while ((match = trRegex.exec(json.html)) !== null) {
            const row = match[1];
            const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const tds = [];
            let tdMatch;
            while ((tdMatch = tdRegex.exec(row)) !== null) {
                tds.push(cleanHtmlText(tdMatch[1]));
            }
            if (tds.length >= 2) {
                announcements.push({
                    date: tds[0] || '',
                    category: tds[1] || '',
                    title: tds[2] || tds[1] || ''
                });
            }
        }
        return announcements.slice(0, 5);
    } catch (e) {
        return [];
    }
}

/**
 * Parses dividends and entitlements from KLSE Screener overview page
 */
async function fetchEntitlements(code) {
    const url = `https://www.klsescreener.com/v2/stocks/view/${code}`;
    const res = await fetchUrl(url);
    if (res.status !== 200 || !res.data) return [];

    const html = res.data;
    const idx = html.indexOf('id="dividends"');
    if (idx === -1) return [];

    const section = html.substring(idx, idx + 10000);
    const entitlements = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;

    while ((match = trRegex.exec(section)) !== null) {
        const rowContent = match[1];
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const tds = [];
        let tdMatch;
        while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
            tds.push(cleanHtmlText(tdMatch[1]));
        }
        if (tds.length >= 4) {
            const annDate = tds[0] || '';
            const financialYear = tds[1] || '';
            const type = tds[2] || '';
            const exDate = tds[3] || '';
            const paymentDate = tds[4] || '';
            const amount = tds[5] || '';

            if (!annDate.toLowerCase().includes('ann. date') && !exDate.toLowerCase().includes('ex-date')) {
                const typeLower = type.toLowerCase();
                const isDiv = typeLower.includes('dividend') || typeLower.includes('interim') || typeLower.includes('final') || typeLower.includes('special') || typeLower.includes('distribution');
                
                entitlements.push({
                    annDate,
                    financialYear,
                    type,
                    exDate,
                    paymentDate,
                    amount,
                    isDividend: isDiv
                });
            }
        }
    }
    return entitlements.slice(0, 5);
}

/**
 * Main module function: Enriches a stock candidate object with corporate event risks
 */
async function getCorporateNewsRisk(stockCode, stockName) {
    if (!stockCode) {
        return { hasNewsAlert: false, newsBadges: [], announcements: [], entitlements: [] };
    }

    const [announcements, entitlements] = await Promise.all([
        fetchAnnouncements(stockCode),
        fetchEntitlements(stockCode)
    ]);

    const newsBadges = [];
    let hasNewsAlert = false;

    // 1. Analyze Entitlements (Ex-Dividend) - Only flag active & upcoming dividends (within -5 days to +30 days)
    const divEntitlements = entitlements.filter(e => e.isDividend);
    if (divEntitlements.length > 0) {
        const latestEnt = divEntitlements[0];
        if (latestEnt.exDate) {
            const exDateObj = new Date(latestEnt.exDate);
            const now = new Date();
            let isRelevant = true;
            if (!isNaN(exDateObj.getTime())) {
                const diffDays = Math.round((exDateObj.getTime() - now.getTime()) / (24 * 3600 * 1000));
                // Only alert if ex-date is within last 5 days or next 30 days
                isRelevant = (diffDays >= -5 && diffDays <= 30);
            }
            if (isRelevant) {
                newsBadges.push({
                    type: 'EX_DIVIDEND',
                    label: `Ex-Div: ${latestEnt.exDate}`,
                    severity: 'warning',
                    title: `${latestEnt.type} (${latestEnt.amount || 'Dividend'}) | Ex-Date: ${latestEnt.exDate}`
                });
                hasNewsAlert = true;
            }
        }
    }

    // 2. Analyze Recent Announcements (QR, Rights, Placement, Shareholding)
    if (announcements.length > 0) {
        for (const ann of announcements) {
            const catUpper = ann.category.toUpperCase();
            const titleUpper = ann.title.toUpperCase();

            if (titleUpper.includes('QUARTERLY') || titleUpper.includes('FINANCIAL RESULTS') || catUpper.includes('FINANCIAL')) {
                if (!newsBadges.some(b => b.type === 'EARNINGS_QR')) {
                    newsBadges.push({
                        type: 'EARNINGS_QR',
                        label: `Earnings Release`,
                        severity: 'danger',
                        title: `[${ann.date}] ${ann.title}`
                    });
                    hasNewsAlert = true;
                }
            } else if (titleUpper.includes('RIGHTS ISSUE') || titleUpper.includes('PRIVATE PLACEMENT') || titleUpper.includes('BONUS ISSUE')) {
                if (!newsBadges.some(b => b.type === 'CORP_ACTION')) {
                    newsBadges.push({
                        type: 'CORP_ACTION',
                        label: `Corp Action`,
                        severity: 'danger',
                        title: `[${ann.date}] ${ann.title}`
                    });
                    hasNewsAlert = true;
                }
            } else if (titleUpper.includes('SHAREHOLDINGS') || titleUpper.includes('SUBSTANTIAL')) {
                if (!newsBadges.some(b => b.type === 'SHAREHOLDING')) {
                    newsBadges.push({
                        type: 'SHAREHOLDING',
                        label: `Insider Action`,
                        severity: 'info',
                        title: `[${ann.date}] ${ann.title}`
                    });
                }
            }
        }

        // Add top announcement badge if no high-severity badge was added yet
        if (newsBadges.length === 0 && announcements.length > 0) {
            const topAnn = announcements[0];
            newsBadges.push({
                type: 'RECENT_NEWS',
                label: `News: ${topAnn.date}`,
                severity: 'info',
                title: `[${topAnn.date}] ${topAnn.category} - ${topAnn.title}`
            });
        }
    }

    return {
        hasNewsAlert,
        newsBadges,
        announcements,
        entitlements
    };
}

module.exports = {
    getCorporateNewsRisk,
    fetchAnnouncements,
    fetchEntitlements
};
