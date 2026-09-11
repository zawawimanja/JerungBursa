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

    try {
        console.log(`[Vercel Cron] Triggering GitHub Actions dispatch for ${repoOwner}/${repoName}...`);

        const headers = {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Vercel-Cron-Trigger'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await axios.post(
            `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`,
            { event_type: 'scrape_trigger' },
            { headers }
        );

        return res.status(200).json({
            success: true,
            message: 'GitHub Actions scrape_trigger dispatched successfully!',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[Vercel Cron Error]:', err.message);
        return res.status(500).json({
            error: `Failed to dispatch GitHub Action: ${err.response?.data?.message || err.message}`,
            timestamp: new Date().toISOString()
        });
    }
};
