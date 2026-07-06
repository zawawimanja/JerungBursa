const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🏁 Memulakan analisis harian JerungBursa...');

try {
    const cwd = __dirname;
    
    // 1. Jalankan Scraper
    console.log('\n[1/2] Menjalankan imbasan pasaran semasa (scrape-real.js)...');
    execSync('node scrape-real.js', { cwd, stdio: 'inherit' });
    
    // 2. Jalankan Kompilasi Backtest
    console.log('\n[2/2] Mengemas kini laporan backtest (compile_backtest.js)...');
    execSync('node scratch/compile_backtest.js', { cwd, stdio: 'inherit' });
    
    console.log('\n✅ Semua proses selesai dengan jaya!');
} catch (error) {
    console.error('\n❌ Ralat berlaku semasa menjalankan proses:', error.message);
    process.exit(1);
}
