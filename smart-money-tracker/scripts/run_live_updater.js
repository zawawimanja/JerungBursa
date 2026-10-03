const { exec } = require('child_process');
const path = require('path');

// Interval kemas kini: 5 minit (300,000 ms)
const INTERVAL = 5 * 60 * 1000;

let isRunning = false;

// Guard: tracker generator hanya jalan SEKALI selepas 5:50 PM MYT (data muktamad)
global.lastTrackerGeneratedDate = null;

function getMytTime(now) {
    return {
        hour:    parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', hour12: false })),
        min:     parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', minute: '2-digit' })),
        dateStr: now.toLocaleString('en-CA',  { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 10) // YYYY-MM-DD
    };
}

function runScraper() {
    if (isRunning) {
        console.log(`[${new Date().toLocaleTimeString()}] Pusingan imbasan terdahulu masih berjalan. Melepaskan pusingan ini...`);
        return;
    }

    const now = new Date();
    const day = now.getDay();
    const { hour: mytHour, min: mytMin, dateStr: todayStr } = getMytTime(now);

    // Hanya run pada hari bekerja (Isnin–Jumaat) dan waktu pasaran MYT (8:30 AM – 6:00 PM)
    const isWorkingDay  = day >= 1 && day <= 5;
    const isMarketHours = (mytHour >= 8 && mytHour < 18);

    if (!isWorkingDay || !isMarketHours) {
        console.log(`[${now.toLocaleTimeString()}] Luar waktu pasaran. Menunggu sesi pasaran seterusnya...`);
        return;
    }

    isRunning = true;
    console.log(`\n==================================================`);
    console.log(`[${now.toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}] 🔄 Memulakan imbasan pasaran live (5-Minit Auto-Run)...`);
    console.log(`==================================================`);

    const scrapeScript    = path.join(__dirname, 'scrape-real.js');
    const projectRoot     = path.join(path.join(__dirname, '..'), '..');
    const trackerScript   = path.join(__dirname, 'generate_fresh_rider_tracker.js');
    const htTrackerScript = path.join(__dirname, 'generate_hot_theme_tracker.js');
    const eqTrackerScript = path.join(__dirname, 'generate_daily_equity_tracker.js');

    // ─── LANGKAH 1: Kemas kini harga live (setiap 5 minit) ───────────────────
    exec(`node "${scrapeScript}"`, { cwd: path.join(__dirname, '..') }, (error, stdout) => {
        if (error) {
            console.error(`❌ Ralat semasa mengemas kini harga: ${error.message}`);
            isRunning = false;
            return;
        }
        if (stdout) console.log(stdout);

        // ─── LANGKAH 2: Jana Tracker FR + HT + EQ — SEKALI SAHAJA selepas 5:50 PM MYT ───
        // Data penutupan muktamad baru stabil selepas 5:50 PM (SOP Rule 5).
        // Jika dijana sebelum itu, closeTightness & pullback intraday akan beri entry palsu.
        const isPostClose       = (mytHour === 17 && mytMin >= 50) || mytHour >= 18;
        const trackerAlreadyRan = global.lastTrackerGeneratedDate === todayStr;

        if (isPostClose && !trackerAlreadyRan) {
            global.lastTrackerGeneratedDate = todayStr;
            console.log(`🏁 [${todayStr} ${mytHour}:${String(mytMin).padStart(2,'0')} MYT] Data penutupan muktamad — Jana tracker FR + HT + EQ...`);
            exec(`node "${trackerScript}" && node "${htTrackerScript}" && node "${eqTrackerScript}"`,
                { cwd: path.join(__dirname, '..') },
                (tErr, tOut) => {
                    if (tErr) console.error(`⚠️ Ralat jana tracker: ${tErr.message}`);
                    else console.log(`✅ Tracker FR + HT + EQ berjaya dijana (data muktamad ${todayStr}).`);
                    if (tOut) console.log(tOut.split('\n')[0]);
                }
            );
        } else if (!isPostClose) {
            console.log(`⏳ [${mytHour}:${String(mytMin).padStart(2,'0')} MYT] Generator tracker ditangguh — tunggu data muktamad selepas 5:50 PM MYT.`);
        } else {
            console.log(`✅ Tracker FR + HT sudah dijana hari ini (${todayStr}). Tiada perlu jana semula.`);
        }

        // ─── LANGKAH 3: Post-Market Close Buy Alert (5:15–5:35 PM MYT) ──────
        // Dijalankan selepas pasaran tutup (5:00 PM) untuk senarai belian muktamad
        if (mytHour === 17 && mytMin >= 15 && mytMin <= 35 && global.lastAlertSentDate !== todayStr) {
            global.lastAlertSentDate = todayStr;
            console.log(`📢 Menjalankan Post-Market Close Buy Alert Telegram (5:15 PM)...`);
            const alertScript = path.join(__dirname, 'buy_alert.js');
            exec(`node "${alertScript}"`, { cwd: path.join(__dirname, '..') }, (aErr, aOut) => {
                if (aErr) console.error(`⚠️ Ralat Buy Alert: ${aErr.message}`);
                else if (aOut) console.log(`✅ Buy Alert Telegram Selesai dihantar.`);
            });
        }

        // ─── LANGKAH 5: Portfolio TP/SL Alert (setiap 5 minit) ───────────────
        const portfolioScript = path.join(__dirname, 'portfolio_alert.js');
        exec(`node "${portfolioScript}"`, { cwd: path.join(__dirname, '..') }, (pErr, pOut) => {
            if (pErr) console.error(`⚠️ Ralat Portfolio Alert: ${pErr.message}`);
            else if (pOut && pOut.trim()) console.log(pOut.trim());
        });

        // ─── LANGKAH 6: Git push data terkini ke GitHub & Vercel ─────────────
        console.log(`📡 Memuat naik data terkini ke GitHub & Vercel...`);
        const gitCmd = `git pull --rebase origin main && git add smart-money-tracker/live_data.json smart-money-tracker/live_data.js smart-money-tracker/fresh_rider_tracker.js smart-money-tracker/hot_theme_tracker.js smart-money-tracker/daily_equity_tracker.js smart-money-tracker/history/ && git commit -m "Auto-update live market data (5-min bot)" && git push origin main`;
        exec(gitCmd, { cwd: projectRoot }, (gitErr) => {
            isRunning = false;
            if (gitErr) {
                if (gitErr.message.includes('nothing to commit')) {
                    console.log(`ℹ️ Tiada perubahan data dikesan.`);
                } else {
                    console.error(`⚠️ Git Status/Push: ${gitErr.message}`);
                }
            } else {
                console.log(`✅ Berjaya push ke Vercel! Pasaran terkini sudah LIVE.`);
            }
        });
    });
}

// Jalankan terus sekali apabila mula
runScraper();

// Ulang setiap 5 minit secara berterusan
setInterval(runScraper, INTERVAL);

console.log(`==================================================`);
console.log(`🚀 Live Price Updater Berjalan di Latar Belakang!`);
console.log(`⏳ Kekerapan scrape harga: Setiap 5 minit (8:30 AM – 6:00 PM MYT)`);
console.log(`🏁 Generator Tracker FR+HT: SEKALI SAHAJA selepas 5:50 PM MYT (data muktamad)`);
console.log(`📌 Tekan Ctrl + C untuk menamatkan program.`);
console.log(`==================================================`);
