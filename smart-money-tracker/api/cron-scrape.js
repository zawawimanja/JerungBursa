// Vercel Serverless Function / Cron Handler
// Triggers GitHub Actions workflow via repository_dispatch automatically

const axios = require('axios');

module.exports = async (req, res) => {
    // Only allow GET / POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = process.env.GITHUB_TOKEN || process.env.GH_PAT;
    const repoOwner = 'zawawimanja';
    const repoName = 'JerungBursa';
    const cronSecret = process.env.CRON_SECRET;

    // 🔒 Auth Guard: Pastikan trigger datang dari Vercel Cron atau pihak yang ada secret
    if (cronSecret) {
        const authHeader = req.headers['authorization'] || '';
        const querySecret = req.query.secret || '';
        const isAuthorized = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
        if (!isAuthorized) {
            return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
        }
    }

    // ✅ Diagnostic: Jika tiada token, kembalikan 401 dengan panduan
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'GITHUB_TOKEN tidak dijumpai dalam Vercel Environment Variables.',
            fix: 'Pergi ke Vercel Dashboard > Settings > Environment Variables > Tambah GITHUB_TOKEN dengan nilai Personal Access Token GitHub awi.',
            timestamp: new Date().toISOString()
        });
    }

    // Tentukan jenis tugasan: buy_alert (lepas market close) atau scrape_trigger (default)
    const jobParam = String(req.query.job || req.query.type || req.query.event || '').toLowerCase();
    
    if (jobParam.includes('morning')) {
        return res.status(200).json({
            success: true,
            message: 'Morning alert telah dinyahaktifkan (retired). Gunakan buy_alert pasca penutupan pasaran.',
            timestamp: new Date().toISOString()
        });
    }

    let event_type = 'scrape_trigger';
    if (jobParam.includes('buy') || jobParam.includes('close')) {
        event_type = 'buy_alert_trigger';
    } else {
        event_type = 'scrape_trigger';
    }

    try {
        console.log(`[Vercel Cron] Triggering GitHub Actions dispatch (${event_type}) for ${repoOwner}/${repoName}...`);

        const response = await axios.post(
            `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`,
            { event_type },
            {
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Vercel-Cron-Trigger'
                }
            }
        );

        return res.status(200).json({
            success: true,
            event_type,
            message: `GitHub Actions ${event_type} dispatched successfully!`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        const githubMsg = err.response?.data?.message || err.message;
        console.error('[Vercel Cron Error]:', githubMsg);
        return res.status(500).json({
            error: `Failed to dispatch GitHub Action: ${err.response?.data?.message || err.message}`,
            timestamp: new Date().toISOString()
        });
    }
};
