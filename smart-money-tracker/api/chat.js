// Vercel Serverless Function — Groq API Proxy
// Key lives in Vercel Environment Variables, NEVER in the browser.

const axios = require('axios');
const { isIP } = require('node:net');
const ipRequests = new Map(); // Store: IP -> { count, resetTime }
const LIMIT_PERIOD = 5 * 60 * 1000;
const MAX_REQUESTS = 10;
const MAX_CLIENTS = 10000;

function clientIp(req) {
    // Vercel supplies the forwarded client address. Extra proxy hops must not
    // create a new rate-limit bucket for every request from the same client.
    const forwarded = req.headers?.['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded);
    const address = typeof first === 'string' ? first.split(',')[0].trim() : '';
    return isIP(address) ? address : (req.socket?.remoteAddress || 'anonymous');
}

function isRateLimited(ip) {
    const now = Date.now();

    // Prune old entries to prevent memory growth
    for (const [key, val] of ipRequests.entries()) {
        if (now >= val.resetTime) {
            ipRequests.delete(key);
        }
    }

    if (!ipRequests.has(ip)) {
        if (ipRequests.size >= MAX_CLIENTS) return Math.ceil(LIMIT_PERIOD / 1000);
        ipRequests.set(ip, {
            count: 1,
            resetTime: now + LIMIT_PERIOD
        });
        return 0;
    }

    const clientData = ipRequests.get(ip);
    if (clientData.count >= MAX_REQUESTS) {
        return Math.max(1, Math.ceil((clientData.resetTime - now) / 1000));
    }

    clientData.count++;
    return 0;
}

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const contentType = req.headers?.['content-type'];
    if (contentType !== undefined && (typeof contentType !== 'string' || !/^application\/json(?:\s*;|\s*$)/i.test(contentType))) {
        return res.status(415).json({ error: 'Content-Type must be application/json.' });
    }

    const GROQ_KEY = process.env.GROQ_API_KEY?.trim();
    if (!GROQ_KEY) {
        return res.status(500).json({ error: 'API key not configured on server.' });
    }

    try {
        // Manually parse body if needed (some Vercel runtimes don't auto-parse)
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) {
                return res.status(400).json({ error: 'Invalid JSON body.' });
            }
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ error: 'Request body must be a JSON object.' });
        }

        const { prompt, systemPrompt, model, temperature, max_tokens } = body;
        if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'No prompt provided.' });
        if (prompt.length > 15000) return res.status(400).json({ error: 'Prompt too long (max 15,000 characters).' });

        // Invalid input must not consume the client's provider request budget.
        const retryAfter = isRateLimited(clientIp(req));
        if (retryAfter) {
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }

        // Whitelist model yang dibenarkan untuk elak salah guna kos/sumber
        const ALLOWED_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        const selectedModel = ALLOWED_MODELS.includes(model) ? model : 'llama-3.3-70b-versatile';

        const safeSystemPrompt = (typeof systemPrompt === 'string' && systemPrompt.length <= 5000)
            ? systemPrompt
            : 'You are JerungBursa AI, a professional Bursa Malaysia trading assistant.';

        // Clamp max_tokens antara 64 dan 2048
        const requestedTokens = (typeof max_tokens === 'number' || (typeof max_tokens === 'string' && /^\d+$/.test(max_tokens)))
            ? Number(max_tokens) : NaN;
        const maxTokens = (Number.isFinite(requestedTokens) && requestedTokens > 0)
            ? Math.min(Math.max(Math.trunc(requestedTokens), 64), 2048)
            : 1024;

        const rawTemp = Number.isFinite(temperature) ? temperature : 0.5;
        const temp = Math.min(Math.max(rawTemp, 0), 1.0);

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: selectedModel,
            messages: [
                { role: 'system', content: safeSystemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: temp
        }, {
            timeout: 20000,
            headers: {
                'Authorization': `Bearer ${GROQ_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const text = response?.data?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) {
            return res.status(502).json({ error: 'AI service returned an empty response. Please try again.' });
        }
        return res.status(200).json({ text });

    } catch (err) {
        // Axios errors contain request headers, including the provider API key.
        const status = err?.response?.status;
        const timedOut = err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT';
        console.error('Chat provider request failed', { status: Number.isInteger(status) ? status : undefined, timedOut });
        if (timedOut) {
            return res.status(504).json({ error: 'AI request timed out. Please try again.' });
        }
        if (status === 429) {
            res.setHeader('Retry-After', '30');
            return res.status(429).json({ error: 'AI service is busy. Please try again later.' });
        }
        return res.status(502).json({ error: 'AI service is unavailable. Please try again later.' });
    }
};
