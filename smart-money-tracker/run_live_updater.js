const { exec } = require('child_process');
const path = require('path');

// Interval kemas kini: 1 jam (3,600,000 ms) - sangat ringan dan selamat
const INTERVAL = 60 * 60 * 1000; 

function runScraper() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    // Hanya run pada hari bekerja (Isnin - Jumaat: 1 - 5) dan waktu pasaran dibuka (8:30 pagi - 5:30 petang)
    const isWorkingDay = day >= 1 && day <= 5;
    const isMarketHours = (hour >= 8 && hour < 18);
    
    if (!isWorkingDay || !isMarketHours) {
        console.log(`[${now.toLocaleTimeString()}] Luar waktu pasaran. Menunggu sesi pasaran seterusnya...`);
        return;
    }
    
    console.log(`\n==================================================`);
    console.log(`[${now.toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}] Memulakan kemas kini harga live...`);
    console.log(`==================================================`);
    
    const scrapeScript = path.join(__dirname, 'scrape-real.js');
    
    exec(`node "${scrapeScript}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Ralat semasa mengemas kini harga: ${error.message}`);
            return;
        }
        if (stderr) {
            console.warn(`⚠️ Warning: ${stderr}`);
        }
        console.log(stdout);
        console.log(`✅ Kemas kini selesai secara automatik!`);
    });
}

// Jalankan terus sekali apabila mula
runScraper();

// Ulang setiap 1 jam secara berterusan
setInterval(runScraper, INTERVAL);

console.log(`==================================================`);
console.log(`🚀 Live Price Updater Berjalan di Latar Belakang!`);
console.log(`⏳ Kekerapan: Setiap 1 jam sekali (Waktu Pasaran: 8.30 Pagi - 5.30 Petang)`);
console.log(`📌 Tekan Ctrl + C untuk menamatkan program.`);
console.log(`==================================================`);
