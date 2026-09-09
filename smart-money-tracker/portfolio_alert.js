// =============================================================
// REAL-TIME PORTFOLIO & INTRADAY TP/SL ALERT (JerungBursa)
// -------------------------------------------------------------
// Berjalan setiap 5 minit waktu pasaran dibuka (8:30 AM - 5:30 PM).
// Memantau kaunter portfolio aktif pengguna (user_portfolio.json):
// 1. Breakeven Trigger (+5%): Gesaan alih SL ke modal (Free Trade)
// 2. Target TP1 (+10%): Gesaan tuai 50% untung, biar baki ke TP2
// 3. Target TP2: Gesaan tuai keuntungan penuh
// 4. Amaran SL (< 1.5%): Amaran awal kawal risiko
// 5. SL Terlanggar: Gesaan cut loss berdisiplin
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

const portfolioFile = path.join(__dirname, 'user_portfolio.json');
const historyAlertsFile = path.join(__dirname, 'portfolio_alerts_history.json');
const liveFile = path.join(__dirname, 'live_data.json');

function fmtPrice(p) { return p == null ? '—' : Number(p).toFixed(3); }
function fmtPct(p) { return p == null ? '—' : (p > 0 ? '+' : '') + Number(p).toFixed(2) + '%'; }

(async () => {
    if (!fs.existsSync(portfolioFile)) return;
    const portfolio = JSON.parse(fs.readFileSync(portfolioFile, 'utf8'));
    if (!Array.isArray(portfolio) || portfolio.length === 0) return;

    let liveRows = [];
    if (fs.existsSync(liveFile)) {
        try {
            const liveData = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
            liveRows = liveData.topVolume || [];
        } catch (e) { /* fallback */ }
    }
    const liveMap = new Map(liveRows.map(r => [(r.name || '').toUpperCase(), r]));

    // Baca sejarah alert yang telah dihantar untuk elak spam berulang
    let alertHistory = {};
    if (fs.existsSync(historyAlertsFile)) {
        try { alertHistory = JSON.parse(fs.readFileSync(historyAlertsFile, 'utf8')); } catch (e) { alertHistory = {}; }
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: false });

    const triggeredAlerts = [];

    for (const pos of portfolio) {
        const nm = (pos.name || '').toUpperCase();
        const live = liveMap.get(nm);
        const curPrice = live ? live.price : pos.buyPrice;
        if (!curPrice || curPrice <= 0) continue;

        const gainPct = +(((curPrice - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2);
        const distToSl = +(((curPrice - pos.slPrice) / pos.slPrice) * 100).toFixed(2);
        const grossPnl = +(((curPrice - pos.buyPrice) / pos.buyPrice) * pos.allocation).toFixed(2);

        // 1. Semakan TP2
        if (pos.tp2 && curPrice >= pos.tp2) {
            const key = `${todayStr}_${nm}_TP2`;
            if (!alertHistory[key]) {
                alertHistory[key] = true;
                triggeredAlerts.push({
                    type: 'TP2',
                    badge: '🚀 TARGET TP2 TERCAPAI (MAX GAIN)!',
                    name: pos.name,
                    curPrice,
                    target: pos.tp2,
                    gainPct,
                    grossPnl,
                    advice: `Harga telah mencecah sasaran TP2 RM ${fmtPrice(pos.tp2)} (${fmtPct(gainPct)})! Tuai keuntungan penuh dan simpan tunai untuk kaunter baharu.`
                });
            }
        }
        // 2. Semakan TP1
        else if (pos.tp1 && curPrice >= pos.tp1) {
            const key = `${todayStr}_${nm}_TP1`;
            if (!alertHistory[key]) {
                alertHistory[key] = true;
                triggeredAlerts.push({
                    type: 'TP1',
                    badge: '🎉 TARGET TP1 TERCAPAI (+10% LOCK)!',
                    name: pos.name,
                    curPrice,
                    target: pos.tp1,
                    gainPct,
                    grossPnl,
                    advice: `Harga mencecah sasaran TP1 RM ${fmtPrice(pos.tp1)} (${fmtPct(gainPct)})! Kunci 50% untung (+RM ${(grossPnl*0.5).toFixed(2)} masuk poket) dan naikkan Stop Loss ke harga modal RM ${fmtPrice(pos.buyPrice)}.`
                });
            }
        }
        // 3. Semakan Breakeven Trigger (+5% gain)
        else if (gainPct >= 5.0 && gainPct < 9.5) {
            const key = `${todayStr}_${nm}_BE`;
            if (!alertHistory[key]) {
                alertHistory[key] = true;
                triggeredAlerts.push({
                    type: 'BE',
                    badge: '🛡️ ALERT RISK-FREE (NAIKKAN STOP LOSS KE MODAL)!',
                    name: pos.name,
                    curPrice,
                    gainPct,
                    grossPnl,
                    advice: `Saham dah untung +${gainPct.toFixed(1)}%! Pindahkan Stop Loss dari RM ${fmtPrice(pos.slPrice)} ke harga modal RM ${fmtPrice(pos.buyPrice)}. Sekarang dagangan anda 100% BEBAS RISIKO!`
                });
            }
        }

        // 4. Semakan Stop Loss Terlanggar
        if (pos.slPrice && curPrice <= pos.slPrice) {
            const key = `${todayStr}_${nm}_SL_HIT`;
            if (!alertHistory[key]) {
                alertHistory[key] = true;
                triggeredAlerts.push({
                    type: 'SL_HIT',
                    badge: '🛑 STOP LOSS TERLANGGAR (CUT LOSS DISIPLIN)!',
                    name: pos.name,
                    curPrice,
                    target: pos.slPrice,
                    gainPct,
                    grossPnl,
                    advice: `Harga semasa RM ${fmtPrice(curPrice)} telah jatuh menembusi paras Stop Loss RM ${fmtPrice(pos.slPrice)} (${fmtPct(gainPct)}). Potong kerugian serta-merta untuk melindungi baki modal pokok.`
                });
            }
        }
        // 5. Semakan Hampir Stop Loss (< 1.5% dari SL)
        else if (pos.slPrice && distToSl > 0 && distToSl <= 1.5) {
            const key = `${todayStr}_${nm}_SL_NEAR`;
            if (!alertHistory[key]) {
                alertHistory[key] = true;
                triggeredAlerts.push({
                    type: 'SL_NEAR',
                    badge: '⚠️ AMARAN KAWAL RISIKO (HAMPIR PARAS SL)!',
                    name: pos.name,
                    curPrice,
                    target: pos.slPrice,
                    distToSl,
                    gainPct,
                    grossPnl,
                    advice: `Harga semasa RM ${fmtPrice(curPrice)} hanya berjarak ${distToSl.toFixed(1)}% dari paras Stop Loss RM ${fmtPrice(pos.slPrice)}. Bersiap sedia di broker untuk bertindak jika ditembusi.`
                });
            }
        }
    }

    if (triggeredAlerts.length === 0) {
        // Tiada alert milestone baharu dalam pusingan 5-minit ini
        return;
    }

    // Bina teks Telegram
    const lines = [];
    lines.push(`🔔 *SMART MONEY TRACKER — PORTFOLIO INTRADAY ALERT*`);
    lines.push(`⏰ ${todayStr} ${timeStr} MYT · Pemantauan Pegangan Semasa`);
    lines.push('');

    triggeredAlerts.forEach((a, i) => {
        lines.push(`${i + 1}. *${a.badge}*`);
        lines.push(`   📌 Kaunter: *${a.name}*`);
        lines.push(`   💵 Harga Semasa: *RM ${fmtPrice(a.curPrice)}* (${fmtPct(a.gainPct)})`);
        if (a.target) lines.push(`   🎯 Paras Rujukan: *RM ${fmtPrice(a.target)}*`);
        if (a.grossPnl !== undefined) lines.push(`   📊 PnL Semasa: *RM ${a.grossPnl >= 0 ? '+' : ''}${a.grossPnl.toFixed(2)}*`);
        lines.push(`   💡 Panduan Tindakan: ${a.advice}`);
        lines.push('');
    });

    lines.push('Generated by portfolio_alert.js · JerungBursa');
    const msg = lines.join('\n');

    console.log(`📢 Menghantar ${triggeredAlerts.length} alert portfolio ke Telegram...`);

    // Simpan alertHistory
    fs.writeFileSync(historyAlertsFile, JSON.stringify(alertHistory, null, 2), 'utf8');

    // Hantar ke Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
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
            if (r && r.ok) console.log('✅ Telegram Portfolio Alert berjaya dihantar.');
            else console.error('❌ Telegram gagal:', JSON.stringify(r));
        } catch (e) {
            console.error('❌ Telegram error:', e.message);
        }
    }
})().catch(e => {
    console.error('❌ portfolio_alert.js error:', e);
});
