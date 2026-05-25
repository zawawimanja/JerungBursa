const fs = require('fs');
const path = require('path');

console.log("=====================================================");
console.log("🤖 AI ADVISOR: STRATEGI MODAL RM5,000 (SMART MONEY)");
console.log("=====================================================\n");

try {
    const dataPath = path.join(__dirname, 'live_data.json');
    if (!fs.existsSync(dataPath)) {
        console.log("❌ Tiada fail live_data.json dijumpai. Sila run 'node scrape-real.js' dahulu.");
        process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath);
    const counters = JSON.parse(rawData);

    // Tapis yang uptrend & turnover > 3 Juta
    const uptrendCounters = counters.filter(c => c.change > 0 && c.turnover >= 3000000);

    // Cari Golden Entry (Kenaikan 0.1% hingga 4.0% sahaja)
    const goldenEntries = uptrendCounters.filter(c => c.change <= 4.0);

    // Untuk modal RM5K, kita pecah kepada Lincah (<RM1.50) dan Stabil (>=RM1.50)
    const modalKecil = goldenEntries.filter(c => c.price >= 0.30 && c.price < 1.50);
    const modalBesar = goldenEntries.filter(c => c.price >= 1.50);

    console.log("🎯 REKOMENDASI TERBAIK UNTUK MODAL RM5,000 HARI INI:");
    console.log("-----------------------------------------------------");
    
    if (modalKecil.length > 0) {
        console.log("⚡ KATEGORI LINCAH (Potensi 5% Cepat - Risiko Sederhana):");
        modalKecil.slice(0, 3).forEach((c, i) => {
            const lotDapat = Math.floor(2500 / (c.price * 100)); // Anggaran modal RM2500 per kaunter
            console.log(`   ${i+1}. ${c.name} (RM ${c.price.toFixed(3)}) | Naik: +${c.change.toFixed(2)}% | Jerung Masuk: ${(c.turnover/1000000).toFixed(2)} Juta`);
            console.log(`      💡 Action Plan: Beli ${lotDapat} lot (Guna modal ~RM2,500). Sedia Take Profit bila untung 5%.\n`);
        });
    } else {
        console.log("⚡ KATEGORI LINCAH: Tiada kaunter yang sesuai fasa 'Golden Entry' hari ini.\n");
    }

    console.log("🛡️ KATEGORI STABIL / BLUECHIP (Peram Santai - Risiko Rendah):");
    if (modalBesar.length > 0) {
        modalBesar.slice(0, 3).forEach((c, i) => {
            const lotDapat = Math.floor(2500 / (c.price * 100)); // Anggaran modal RM2500 per kaunter
            console.log(`   ${i+1}. ${c.name} (RM ${c.price.toFixed(3)}) | Naik: +${c.change.toFixed(2)}% | Jerung Masuk: ${(c.turnover/1000000).toFixed(2)} Juta`);
            console.log(`      💡 Action Plan: Beli ${lotDapat} lot (Guna modal ~RM2,500). Boleh peram seminggu dua.\n`);
        });
    } else {
         console.log("🛡️ KATEGORI STABIL: Tiada kaunter gergasi yang baru nak naik hari ini.\n");
    }

    console.log("=====================================================");
    console.log("⚠️ PENGURUSAN RISIKO: Jangan All-In pada 1 kaunter!");
    console.log("Pecahkan RM5K kepada 2 kaunter pilihan di atas (Contoh: 1 Lincah, 1 Stabil).");
    console.log("=====================================================\n");

} catch(e) {
    console.log("❌ Ralat membaca data:", e.message);
}
