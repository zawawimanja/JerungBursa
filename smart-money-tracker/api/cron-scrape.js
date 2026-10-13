// Vercel Serverless Function / Cron Handler
// Triggers GitHub Actions workflow via repository_dispatch automatically

const axios = require('axios');
const { timingSafeEqual } = require('node:crypto');

function matchesSecret(value, secret) {
    if (typeof value !== 'string') return false;
    const actual = Buffer.from(value);
    const expected = Buffer.from(secret);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    // Only allow GET / POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_PAT?.trim();
    const repoOwner = 'zawawimanja';
    const repoName = 'JerungBursa';
    const cronSecret = process.env.CRON_SECRET;
    const query = req.query || {};

    // A missing secret must never turn a workflow/Telegram trigger into a public endpoint.
    if (!cronSecret || !cronSecret.trim()) {
        return res.status(503).json({ success: false, error: 'Cron authentication is not configured on server.' });
    }
    const isAuthorized = matchesSecret(req.headers?.authorization, `Bearer ${cronSecret}`) || matchesSecret(query.secret, cronSecret);
    if (!isAuthorized) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    // Tentukan jenis tugasan: buy_alert (lepas market close) atau scrape_trigger (default)
    let jobParam = '';
    for (const key of ['job', 'type', 'event']) {
        if (query[key] === undefined || query[key] === '') continue;
        if (typeof query[key] !== 'string') {
            return res.status(400).json({ success: false, error: 'Job must be a single string.' });
        }
        jobParam = query[key].trim().toLowerCase();
        break;
    }

    const morningJobs = ['morning', 'morning_alert', 'morning_alert_trigger'];
    const buyJobs = ['buy', 'buy_alert', 'buy_alert_trigger', 'close', 'market_close', 'after_close'];
    const scrapeJobs = ['', 'scrape', 'scrape_trigger'];
    if (![...morningJobs, ...buyJobs, ...scrapeJobs].includes(jobParam)) {
        return res.status(400).json({ success: false, error: 'Unknown job. Use scrape or buy_alert.' });
    }
    
    if (morningJobs.includes(jobParam)) {
        return res.status(200).json({
            success: true,
            message: 'Morning alerts are retired. Use buy_alert after market close.',
            timestamp: new Date().toISOString()
        });
    }

    if (!token || !token.trim()) {
        return res.status(503).json({
            success: false,
            error: 'GitHub dispatch is not configured on server.',
            timestamp: new Date().toISOString()
        });
    }
    const event_type = buyJobs.includes(jobParam) ? 'buy_alert_trigger' : 'scrape_trigger';

    try {
        console.log(`[Vercel Cron] Triggering GitHub Actions dispatch (${event_type}) for ${repoOwner}/${repoName}...`);

        const response = await axios.post(
            `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`,
            { event_type },
            {
                timeout: 15000,
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Vercel-Cron-Trigger'
                }
            }
        );

        if (response?.status !== 204) {
            return res.status(502).json({ success: false, error: 'GitHub did not confirm the dispatch.', timestamp: new Date().toISOString() });
        }

        return res.status(200).json({
            success: true,
            event_type,
            message: `GitHub Actions ${event_type} dispatched successfully!`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        // Provider errors may contain authorization headers or secret URLs.
        const upstreamStatus = err?.response?.status;
        const timedOut = err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT';
        console.error('[Vercel Cron] Dispatch failed', { status: Number.isInteger(upstreamStatus) ? upstreamStatus : undefined, timedOut });
        if (upstreamStatus === 429) res.setHeader('Retry-After', '60');
        return res.status(timedOut ? 504 : upstreamStatus === 429 ? 429 : 502).json({
            success: false,
            error: timedOut ? 'GitHub dispatch timed out. Check the workflow before retrying.' : 'GitHub dispatch is unavailable. Please try again later.',
            timestamp: new Date().toISOString()
        });
    }
};
