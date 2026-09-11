// =============================================================
// MORNING OPEN EXECUTION ALERT (8:55 AM - 9:05 AM MYT)
// -------------------------------------------------------------
// Panduan khas bagi trader yang terlepas entry 4:30 PM semalam
// dan ingin membuat belian pada pembukaan pasaran (9:00 AM).
//
// Menganalisis harga pembukaan (Open / Live) vs harga tutup semalam:
// - SITUASI A (🟢 BUY ON OPEN): Flat / Diskaun (Gap <= +0.5%)
// - SITUASI B (🟡 BOLEH MASUK): Gap kecil 1-2 tick (Gap +0.6% hingga +2.5%)
// - SITUASI C (🔴 JANGAN KEJAR): Gap tinggi (Gap > +2.5%)
// =============================================================
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env
function loadEnvFile() {
    try {
        const f = path.join(__dirname, '.env');
        if (!fs.existsSync(f)) return;
        for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    } catch (e) { /* abaikan */ }
}
loadEnvFile();

const SYM_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'symbol_mappings.json'), 'utf8'));

function getYahooMeta(symbol) {
    return new Promise((resolve) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const res0 = data.chart && data.chart.result && data.chart.result[0];
                    if (!res0) return resolve(null);
                    resolve(res0.meta || null);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

function fmtPrice(p) { return p == null ? '—' : Number(p).toFixed(3); }
function fmtPct(p) { return p == null ? '—' : (p > 0 ? '+' : '') + Number(p).toFixed(2) + '%'; }

(async () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: false });

    console.log(`🌅 Menjalankan Morning Open Execution Alert (${dateStr} ${timeStr} MYT)...`);

    // 1. Ambil kaunter Top Ranking VVIP semalam
    let candidates = [];
    const buyAlertFile = path.join(__dirname, 'buy_alert_latest.json');
    if (fs.existsSync(buyAlertFile)) {
        try {
            const bData = JSON.parse(fs.readFileSync(buyAlertFile, 'utf8'));
            if (bData.freshRider && Array.isArray(bData.freshRider.list)) {
                candidates = bData.freshRider.list.slice(0, 5);
            }
        } catch (e) { /* fallback */ }
    }

    // Pastikan calon utama PENTECH & STRATUS ada dalam semakan pagi
    const defaultWatchlist = ['PENTECH', 'STRATUS', 'AMS'];
    const candNames = new Set(candidates.map(c => (c.name || '').toUpperCase()));
    for (const def of defaultWatchlist) {
        if (!candNames.has(def)) {
            candidates.push({ name: def, label: 'WATCHLIST' });
        }
    }

    const results = [];
    for (const c of candidates) {
        const name = (c.name || '').toUpperCase();
        const sym = SYM_MAP[name] || (name + '.KL');
        const meta = await getYahooMeta(sym);

        const prevClose = meta ? (meta.chartPreviousClose || meta.previousClose || c.price) : (c.price || 0);
        const curPrice = meta ? (meta.regularMarketPrice || prevClose) : prevClose;
        const gapPct = prevClose > 0 ? +(((curPrice - prevClose) / prevClose) * 100).toFixed(2) : 0;

        let situation = 'A';
        let situBadge = '🟢 SITUASI A (BUY ON OPEN)';
        let advice = 'Harga di zon tapak asal / diskaun (tiada gap). Risiko SL kekal minima. Sangat selamat untuk match order terus!';
        
        if (gapPct > 2.5) {
            situation = 'C';
            situBadge = '🔴 SITUASI C (JANGAN KEJAR / DO NOT CHASE)';
            advice = `Gap up melompat terlalu tinggi (+${gapPct.toFixed(1)}%). Jarak SL melebar & terdedah jualan pagi. Tunggu pullback 9:30 - 10:00 AM berhampiran RM ${fmtPrice(prevClose)}.`;
        } else if (gapPct > 0.5) {
            situation = 'B';
            situBadge = '🟡 SITUASI B (BOLEH MASUK - TOLERANSI)';
            advice = `Gap up kecil 1-2 tick (+${gapPct.toFixed(1)}%). Risiko SL naik sedikit tetapi masih dalam zon tapak selamat. Boleh masuk mengikut SOP.`;
        } else if (gapPct < -0.1) {
            situBadge = '🟢 SITUASI A (ZON DISKAUN - BUY ON OPEN)';
            advice = `Buka di bawah harga semalam (${gapPct.toFixed(1)}%). Peluang beli pada harga diskaun di bawah tapak!`;
        }

        // Catatan khas kaunter mengikut SOP Jerung
        let specialNote = '';
        if (name === 'PENTECH') {
            specialNote = '🥇 Top 1 VVIP (Day 1 Breakout, Semicon, Gred A, Turnover RM 3.2M 🔥). SL: RM 0.325.';
        } else if (name === 'STRATUS') {
            specialNote = '🥈 Heavyweight Leader (Base 2, Turnover RM 6.2M 🔥, Tightness 1.08%). SL: RM 2.680.';
        } else if (name === 'AMS') {
            specialNote = '⚠️ PANTANG LARANG: Turnover lemau (RM 1.4M), kaunter lama sejak Jun. Utamakan PENTECH / STRATUS.';
        }

        results.push({
            name,
            prevClose,
            curPrice,
            gapPct,
            situation,
            situBadge,
            advice,
            specialNote
        });
    }

    // Susun mengikut keutamaan (PENTECH, STRATUS di atas)
    results.sort((a, b) => {
        if (a.name === 'PENTECH') return -1;
        if (b.name === 'PENTECH') return 1;
        if (a.name === 'STRATUS') return -1;
        if (b.name === 'STRATUS') return 1;
        return a.gapPct - b.gapPct;
    });

    // Bina mesej Telegram
    const lines = [];
    lines.push(`☀️ *SMART MONEY TRACKER — MORNING OPEN EXECUTION ALERT*`);
    lines.push(`⏰ *${dateStr} ${timeStr} MYT* · Analisis Harga Pembukaan Pasaran`);
    lines.push('');
    lines.push(`Bagi yang terlepas entry 4:30 PM semalam dan ingin masuk pagi ini, berikut adalah status 3 Situasi Gap:`);
    lines.push('──────────────────────────────');

    results.forEach((r, i) => {
        lines.push(`${i + 1}. *${r.name}*`);
        lines.push(`   💵 Harga Semalam: *RM ${fmtPrice(r.prevClose)}*`);
        lines.push(`   🎯 Harga Pagi Ini: *RM ${fmtPrice(r.curPrice)}* (${fmtPct(r.gapPct)})`);
        lines.push(`   🚦 Status: *${r.situBadge}*`);
        lines.push(`   💡 Panduan: ${r.advice}`);
        if (r.specialNote) lines.push(`   📌 Catatan: ${r.specialNote}`);
        lines.push('');
    });

    lines.push('🧭 *SOP RINGKAS PAGI*:');
    lines.push('• 🟢 *Situasi A (Gap <= 0%)*: Queue & match terus — zon paling selamat.');
    lines.push('• 🟡 *Situasi B (Gap <= 2.5%)*: Masih sah masuk, risiko SL terkawal.');
    lines.push('• 🔴 *Situasi C (Gap > 2.5%)*: DILARANG kejar market order. Tunggu tenang 9:30 AM.');
    lines.push('');
    lines.push('Generated by morning_alert.js · JerungBursa');

    const msg = lines.join('\n');
    console.log('\n--- PREVIEW MESSAGE ---');
    console.log(msg);
    console.log('-----------------------\n');

    // Simpan fail latest JSON
    fs.writeFileSync(path.join(__dirname, 'morning_alert_latest.json'), JSON.stringify({
        date: dateStr,
        time: timeStr,
        results
    }, null, 2), 'utf8');

    // Hantar ke Telegram jika token wujud
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
        // Kawalan Masa: Elak mesej basi sampai lewat (cth 1:40 PM) jika GitHub Actions cron delay
        const mytHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', hour12: false }));
        const forceAlert = process.env.FORCE_ALERT === 'true';
        if (!forceAlert && (mytHour < 8 || mytHour >= 11)) {
            console.log(`⚠️ Jam sekarang (${timeStr} MYT) di luar sesi pembukaan pagi (8:30 - 11:00 AM). Menghalang pengiriman mesej basi (stale) ke Telegram.`);
            return;
        }

        try {
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            const body = JSON.stringify({ chat_id: chatId, text: msg });
            const r = await new Promise((resolve, reject) => {
                const req = https.request(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
                }, (res) => {
                    let s = '';
                    res.on('data', d => s += d);
                    res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
                });
                req.on('error', reject);
                req.write(body);
                req.end();
            });
            if (r && r.ok) {
                console.log('✅ Telegram Morning Alert berjaya dihantar.');
            } else {
                console.error('❌ Telegram gagal:', JSON.stringify(r));
            }
        } catch (e) {
            console.error('❌ Telegram error:', e.message);
        }
    }
})().catch(e => {
    console.error('❌ morning_alert.js error:', e);
    process.exit(1);
});
