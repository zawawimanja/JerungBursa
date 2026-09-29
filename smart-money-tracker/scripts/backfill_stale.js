// =============================================================
// BACKFILL STALE TRACKER POSITIONS
// Masalah: generator hanya kemas kini posisi OPEN bila saham ADA dalam
// senarai top-volume harian. Bila saham keluar dari senarai (volum jatuh),
// harga "kini" BEKU dan PnL jadi salah (cth. MI beku 7-02, SAM beku 7-08).
// Fix: backfill harga terkini dari Yahoo ikut symbol yang DISAHKAN.
//
// PENTING: nama pendek Bursa bertembung antara syarikat (cth. "SAM" =
// SAM Engineering 9822 ATAU syarikat 2020-IPO yang lain; "MI" = MI
// Technovation 5286 ATAU penny stock lain). Jadi mapping di bawah hanya
// symbol yang DISAHKAN padan dengan harga history tracker.
// =============================================================
const { execSync } = require('child_process');
const path = require('path');

const VERIFIED_SYMBOLS = {
    'MI': '5286.KL',
    'MSC': '5916.KL',
    'NE': '0325.KL',
    'SAMAIDEN': '0223.KL',
    'SAM': '9822.KL',
    'FRONTKN': '0014.KL',
    'MISC': '3816.KL',
    'NEXGRAM': '0096.KL',
    'MINOX': '0288.KL',
    'PENTECH': '0457.KL',
    'SKYECHIP': '5357.KL',
    'CRPMATE': '0331.KL',
    'NATGATE': '0270.KL',
    'ICTZONE': '0358.KL',
    'RAMSSOL': '0236.KL',
    'TEAMSTR': '0393.KL',
    'INFOM': '0265.KL',
    'CNERGEN': '0246.KL',
    'BETA': '0263.KL',
    'AMS': '0399.KL',
    '3REN': '0328.KL',
    'EMPIRE': '5351.KL',
    'INARI': '0166.KL',
    'KGB': '0151.KL',
    'VITROX': '0097.KL',
    'MNHLDG': '0245.KL',
    'UWC': '5292.KL',
    'SLVEST': '0215.KL',
    'GREATEC': '0208.KL',
    'SUNVIEW': '0262.KL',
    'PWRWELL': '0217.KL',
    'ECOMATE': '0239.KL',
    'PEKAT': '0233.KL',
    'SUNLOGY': '0342.KL',
    'OXB': '0340.KL',
    'MTTSL': '0336.KL',
    'STRATUS': '5354.KL',
    'ECOSHOP': '5348.KL',
    'HEGROUP': '0296.KL',
    'EIPOWER': '0337.KL',
    'MMCS': '0346.KL',
    'CBHB': '0339.KL',
    'OGX': '0347.KL',
    'AMBEST': '0341.KL',
    'THMY': '0338.KL',
    'ISF': '0335.KL',
    'KEEMING': '0345.KL',
    'ICENTS': '0343.KL',
};

// Fetch quote Yahoo (sync via child process — generator kekal sync).
function fetchYahooQuotes(symbols) {
    if (!symbols.length) return {};
    const fetchScript = path.join(__dirname, 'backfill_fetch.js');
    try {
        const out = execSync(`node "${fetchScript}" ${symbols.join(' ')}`, { encoding: 'utf8', timeout: 60000, windowsHide: true });
        const line = out.trim().split('\n').pop();
        return JSON.parse(line);
    } catch (e) {
        return {};
    }
}

// Kira hari dagangan (anggaran: Isnin-Jumaat) antara entryDate dan lastDate.
function tradingDaysBetween(from, to) {
    const a = new Date(from), b = new Date(to);
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return 1;
    let count = 1;
    for (let d = new Date(a); d < b; d.setDate(d.getDate() + 1)) {
        const wd = d.getDay();
        if (wd !== 0 && wd !== 6) count++;
    }
    return count;
}

/**
 * Backfill harga terkini untuk posisi OPEN yang beku (lastDate < latestDate).
 * @param {Array} trades - senarai semua trade (diubah in-place)
 * @param {string} latestDate - tarikh dagangan terkini (YYYY-MM-DD)
 * @param {Function} exitFn - fungsi exit (t, price) -> SL; null = guna trail high*0.80
 * @returns {number} bilangan posisi yang dikemas kini
 */
function backfillStaleTrades(trades, latestDate, exitFn) {
    const stale = trades.filter(t =>
        t.status === 'OPEN' &&
        t.lastDate < latestDate &&
        VERIFIED_SYMBOLS[(t.name || '').toUpperCase()]
    );
    if (!stale.length) return 0;

    const symbols = stale.map(t => VERIFIED_SYMBOLS[t.name.toUpperCase()]);
    const quotes = fetchYahooQuotes(symbols);
    if (!Object.keys(quotes).length) return 0;

    let updated = 0;
    for (const t of stale) {
        const sym = VERIFIED_SYMBOLS[t.name.toUpperCase()];
        const q = quotes[sym];
        if (!q || !q.close || q.close <= 0 || q.close > 500) continue;

        // Guard anomaly: harga Yahoo terlalu jauh dari harga rekod terakhir
        // (elak salah padan syarikat — nama pendek bertembung).
        const ratio = q.close / t.currentPrice;
        if (ratio > 1.5 || ratio < 0.5) {
            console.log(`   ⚠️ ${t.name}: Yahoo ${q.close} vs rekod ${t.currentPrice} (ratio ${ratio.toFixed(2)}) — anomaly, SKIP (kemungkinan nama bertembung)`);
            continue;
        }

        t.currentPrice = +q.close.toFixed(3);
        t.lastDate = q.date;
        t.days = tradingDaysBetween(t.entryDate, q.date);
        if (q.close > t.high) { t.high = +q.close.toFixed(3); t.highDate = q.date; }
        t.maxGain = +(((t.high - t.entry) / t.entry) * 100).toFixed(1);

        const sl = exitFn ? exitFn(t, q.close) : t.high * 0.80;
        t.slTrail = +sl.toFixed(3);
        if (q.close <= sl) {
            t.status = 'CLOSED_SL';
            t.exitDate = q.date;
            t.exitPrice = sl;
            t.finalGain = +(((sl - t.entry) / t.entry) * 100).toFixed(1);
        } else {
            t.finalGain = +(((q.close - t.entry) / t.entry) * 100).toFixed(1);
        }
        updated++;
        console.log(`   🔄 Backfill ${t.name.padEnd(9)} ${t.entryDate} @ ${t.entry} -> kini RM${t.currentPrice} (${t.finalGain >= 0 ? '+' : ''}${t.finalGain}%) [${sym}]`);
    }
    return updated;
}

module.exports = { backfillStaleTrades, VERIFIED_SYMBOLS };
