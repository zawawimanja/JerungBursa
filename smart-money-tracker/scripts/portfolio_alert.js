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
        const f = path.join(path.join(__dirname, '..'), '.env');
        if (!fs.existsSync(f)) return;
        for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    } catch (e) { /* abaikan */ }
}

function fmtPrice(p) { return p == null ? '—' : Number(p).toFixed(3); }
function fmtPct(p) { return p == null ? '—' : (p > 0 ? '+' : '') + Number(p).toFixed(2) + '%'; }

function collectPortfolioAlerts(portfolio, liveRows, alertHistory, todayStr) {
    const liveMap = new Map(liveRows.filter(r => r && typeof r.name === 'string' && Number.isFinite(r.price) && r.price > 0).map(r => [r.name.toUpperCase(), r]));
    const triggeredAlerts = [];

    for (const pos of portfolio) {
        if (!pos || typeof pos.name !== 'string' || !Number.isFinite(pos.buyPrice) || pos.buyPrice <= 0) continue;
        const nm = pos.name.toUpperCase();
        const live = liveMap.get(nm);
        // Missing quotes are unknown prices, never a synthetic trade at the entry price.
        const curPrice = live?.price;
        if (!Number.isFinite(curPrice) || curPrice <= 0) continue;

        const gainPct = +(((curPrice - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2);
        const distToSl = +(((curPrice - pos.slPrice) / pos.slPrice) * 100).toFixed(2);
        const grossPnl = Number.isFinite(pos.allocation) ? +(((curPrice - pos.buyPrice) / pos.buyPrice) * pos.allocation).toFixed(2) : undefined;
        const stopHit = Number.isFinite(pos.slPrice) && pos.slPrice > 0 && curPrice <= pos.slPrice;

        // 1. Semakan TP2
        if (!stopHit && Number.isFinite(pos.tp2) && pos.tp2 > 0 && curPrice >= pos.tp2) {
            const key = `${todayStr}_${nm}_TP2`;
            if (!alertHistory[key]) {
                triggeredAlerts.push({
                    key,
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
        else if (!stopHit && Number.isFinite(pos.tp1) && pos.tp1 > 0 && curPrice >= pos.tp1) {
            const key = `${todayStr}_${nm}_TP1`;
            if (!alertHistory[key]) {
                triggeredAlerts.push({
                    key,
                    type: 'TP1',
                    badge: '🎉 TARGET TP1 TERCAPAI (+10% LOCK)!',
                    name: pos.name,
                    curPrice,
                    target: pos.tp1,
                    gainPct,
                    grossPnl,
                    advice: `Harga mencecah sasaran TP1 RM ${fmtPrice(pos.tp1)} (${fmtPct(gainPct)})! Tindakan Wajib SOP Jual 50%: 1. Jual 50% lot sekarang${grossPnl === undefined ? '' : ` (+RM ${(grossPnl * 0.5).toFixed(2)} tunai masuk poket)`} · 2. Naikkan Stop Loss baki 50% ke paras TP1 RM ${fmtPrice(pos.tp1)} · 3. Biarkan baki 50% menunggang ke sasaran TP2 RM ${fmtPrice(pos.tp2)} (+20%+).`
                });
            }
        }
        // 3. Semakan Breakeven Trigger (+5% gain)
        else if (!stopHit && gainPct >= 5.0) {
            const key = `${todayStr}_${nm}_BE`;
            if (!alertHistory[key]) {
                triggeredAlerts.push({
                    key,
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
        if (stopHit) {
            const key = `${todayStr}_${nm}_SL_HIT`;
            if (!alertHistory[key]) {
                triggeredAlerts.push({
                    key,
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
        else if (Number.isFinite(pos.slPrice) && pos.slPrice > 0 && distToSl > 0 && distToSl <= 1.5) {
            const key = `${todayStr}_${nm}_SL_NEAR`;
            if (!alertHistory[key]) {
                triggeredAlerts.push({
                    key,
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

    return triggeredAlerts;
}

function portfolioMessage(triggeredAlerts, todayStr, timeStr) {
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
    return lines.join('\n');
}

function readAlertHistory(file) {
    try {
        const history = JSON.parse(fs.readFileSync(file, 'utf8'));
        return history && typeof history === 'object' && !Array.isArray(history) ? history : {};
    } catch (error) { return {}; }
}

function sendTelegram(token, chatId, text, { httpsClient = https, timeoutMs = 15000 } = {}) {
    const body = JSON.stringify({ chat_id: chatId, text });
    return new Promise((resolve, reject) => {
        let timer;
        let settled = false;
        const finish = (error, reply) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) reject(error);
            else resolve(reply);
        };
        const request = httpsClient.request(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, response => {
            let data = '';
            response.on('data', chunk => { data += chunk; });
            response.on('error', error => finish(error));
            response.on('end', () => {
                try {
                    const reply = JSON.parse(data);
                    if (!Number.isInteger(response.statusCode) || response.statusCode < 200 || response.statusCode >= 300 || reply?.ok !== true) {
                        return finish(new Error('Telegram did not accept the alert.'));
                    }
                    finish(null, reply);
                } catch (error) { finish(new Error('Telegram returned an invalid response.')); }
            });
        });
        request.on('error', error => finish(error));
        timer = setTimeout(() => {
            finish(new Error('Telegram request timed out.'));
            request.destroy();
        }, timeoutMs);
        request.write(body);
        request.end();
    });
}

async function runPortfolioAlerts({ appDir = path.resolve(__dirname, '..'), now = new Date(),
    env = process.env, send = sendTelegram, logger = console } = {}) {
    const portfolioFile = path.join(appDir, 'user_portfolio.json');
    if (!fs.existsSync(portfolioFile)) return { sent: false, alerts: 0 };
    const portfolio = JSON.parse(fs.readFileSync(portfolioFile, 'utf8'));
    if (!Array.isArray(portfolio) || portfolio.length === 0) return { sent: false, alerts: 0 };
    let liveRows = [];
    try {
        const live = JSON.parse(fs.readFileSync(path.join(appDir, 'live_data.json'), 'utf8'));
        for (const key of ['topVolume', 'topGainers', 'topLosers']) {
            if (Array.isArray(live[key])) liveRows.push(...live[key]);
        }
    } catch (error) { /* Missing live data cannot trigger an alert. */ }

    // Legacy tracked history is a read-only seed. New delivery state stays local
    // so portfolio alerts cannot dirty the updater's checkout after publication.
    const stateFile = path.join(appDir, 'portfolio_alerts_state.json');
    const alertHistory = { ...readAlertHistory(path.join(appDir, 'portfolio_alerts_history.json')), ...readAlertHistory(stateFile) };
    const shifted = new Date(now.getTime() + 8 * 3600000);
    const todayStr = shifted.toISOString().slice(0, 10);
    const timeStr = shifted.toISOString().slice(11, 16);
    const alerts = collectPortfolioAlerts(portfolio, liveRows, alertHistory, todayStr);
    if (!alerts.length) return { sent: false, alerts: 0 };

    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
        logger.warn('Telegram credentials missing; portfolio alerts remain pending.');
        return { sent: false, alerts: alerts.length, reason: 'missing-credentials' };
    }
    try {
        const reply = await send(token, chatId, portfolioMessage(alerts, todayStr, timeStr));
        if (reply?.ok !== true) throw new Error('Telegram did not accept the alert.');
    } catch (error) {
        // Transport errors can include a bot token in the request URL.
        logger.error('Telegram delivery failed; portfolio alerts remain pending.');
        return { sent: false, alerts: alerts.length, reason: 'send-failed' };
    }
    for (const alert of alerts) alertHistory[alert.key] = true;
    const temporaryState = `${stateFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryState, JSON.stringify(alertHistory, null, 2), 'utf8');
    fs.renameSync(temporaryState, stateFile);
    logger.log(`Telegram delivered ${alerts.length} portfolio alert(s).`);
    return { sent: true, alerts: alerts.length };
}

if (require.main === module) {
    loadEnvFile();
    runPortfolioAlerts().catch(error => {
        console.error('Portfolio alert processing failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { collectPortfolioAlerts, portfolioMessage, sendTelegram, runPortfolioAlerts };
