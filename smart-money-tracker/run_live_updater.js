const { exec } = require('child_process');
const path = require('path');

// Interval kemas kini: 5 minit (300,000 ms)
const INTERVAL = 5 * 60 * 1000; 

let isRunning = false;

function runScraper() {
    if (isRunning) {
        console.log(`[${new Date().toLocaleTimeString()}] Pusingan imbasan terdahulu masih berjalan. Melepaskan pusingan ini...`);
        return;
    }
    
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    // Hanya run pada hari bekerja (Isnin - Jumaat: 1 - 5) dan waktu pasaran dibuka (8:30 pagi - 5:30 petang MYT)
    const isWorkingDay = day >= 1 && day <= 5;
    const isMarketHours = (hour >= 8 && hour < 18);
    
    if (!isWorkingDay || !isMarketHours) {
        console.log(`[${now.toLocaleTimeString()}] Luar waktu pasaran. Menunggu sesi pasaran seterusnya...`);
        return;
    }
    
    isRunning = true;
    console.log(`\n==================================================`);
    console.log(`[${now.toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}] 🔄 Memulakan imbasan pasaran live (5-Minit Auto-Run)...`);
    console.log(`==================================================`);
    
    const scrapeScript = path.join(__dirname, 'scrape-real.js');
    const projectRoot = path.join(__dirname, '..');
    
    exec(`node "${scrapeScript}"`, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Ralat semasa mengemas kini harga: ${error.message}`);
            isRunning = false;
            return;
        }
        if (stdout) console.log(stdout);

        // Jana semula tracker Fresh Rider DULU, baru push (supaya fail tracker terkini ikut sekali)
        const trackerScript = path.join(__dirname, 'generate_fresh_rider_tracker.js');
        const htTrackerScript = path.join(__dirname, 'generate_hot_theme_tracker.js');
        const eqTrackerScript = path.join(__dirname, 'generate_daily_equity_tracker.js');
        exec(`node "${trackerScript}" && node "${htTrackerScript}" && node "${eqTrackerScript}"`, { cwd: __dirname }, (tErr, tOut) => {
            if (tErr) console.error(`⚠️ Ralat jana tracker Fresh Rider: ${tErr.message}`);
            else if (tOut) console.log(tOut.split('\n')[0]);

            // Waktu tempatan MYT
            const mytHour = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', hour12: false }));
            const mytMin = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', minute: '2-digit' }));
            const todayStr = now.toISOString().slice(0, 10);

            // 1. Morning Open Execution Alert (sekitar 9:01 AM - 9:10 AM MYT)
            if (mytHour === 9 && mytMin >= 1 && mytMin <= 10 && global.lastMorningAlertSentDate !== todayStr) {
                global.lastMorningAlertSentDate = todayStr;
                console.log(`📢 Menjalankan Morning Open Execution Alert Telegram (9:02 AM)...`);
                const morningScript = path.join(__dirname, 'morning_alert.js');
                exec(`node "${morningScript}"`, { cwd: __dirname }, (mErr, mOut) => {
                    if (mErr) console.error(`⚠️ Ralat Morning Alert: ${mErr.message}`);
                    else if (mOut) console.log(`✅ Morning Alert Telegram Selesai dihantar.`);
                });
            }

            // 2. Pre-Close Buy Alert (sekitar 4:30 PM MYT)
            if (mytHour === 16 && mytMin >= 25 && mytMin <= 40 && global.lastAlertSentDate !== todayStr) {
                global.lastAlertSentDate = todayStr;
                console.log(`📢 Menjalankan Buy Alert Telegram (4:30 PM Pre-Close Alert)...`);
                const alertScript = path.join(__dirname, 'buy_alert.js');
                exec(`node "${alertScript}"`, { cwd: __dirname }, (aErr, aOut) => {
                    if (aErr) console.error(`⚠️ Ralat Buy Alert: ${aErr.message}`);
                    else if (aOut) console.log(`✅ Buy Alert Telegram Selesai dihantar.`);
                });
            }

            // 3. Real-Time Portfolio TP/SL & Breakeven Alert (setiap 5 minit)
            const portfolioScript = path.join(__dirname, 'portfolio_alert.js');
            exec(`node "${portfolioScript}"`, { cwd: __dirname }, (pErr, pOut) => {
                if (pErr) console.error(`⚠️ Ralat Portfolio Alert: ${pErr.message}`);
                else if (pOut && pOut.trim()) console.log(pOut.trim());
            });

            console.log(`📡 Memuat naik data terkini ke GitHub & Vercel...`);

            const gitCmd = `git pull --rebase origin main && git add smart-money-tracker/live_data.json smart-money-tracker/live_data.js smart-money-tracker/fresh_rider_tracker.js smart-money-tracker/hot_theme_tracker.js smart-money-tracker/daily_equity_tracker.js smart-money-tracker/history/ && git commit -m "Auto-update live market data (5-min bot) [skip ci]" && git push origin main`;

            exec(gitCmd, { cwd: projectRoot }, (gitErr, gitStdout, gitStderr) => {
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
    });
}

// Jalankan terus sekali apabila mula
runScraper();

// Ulang setiap 5 minit secara berterusan
setInterval(runScraper, INTERVAL);

console.log(`==================================================`);
console.log(`🚀 Live Price Updater Berjalan di Latar Belakang!`);
console.log(`⏳ Kekerapan: Setiap 5 minit sekali (Waktu Pasaran: 8.30 Pagi - 5.30 Petang)`);
console.log(`📌 Tekan Ctrl + C untuk menamatkan program.`);
console.log(`==================================================`);
