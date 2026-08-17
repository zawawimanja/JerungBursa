// =============================================================
// Fetch quote Yahoo untuk backfill posisi beku.
// Dipanggil oleh backfill_stale.js (execSync) — fail berasingan
// supaya elak isu quoting script inline pada Windows.
// Guna: node backfill_fetch.js 5286.KL 9822.KL ...
// Output: JSON { "5286.KL": { close, date }, ... }
// =============================================================
const https = require('https');

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
            let s = '';
            r.on('data', d => s += d);
            r.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

(async () => {
    const symbols = process.argv.slice(2);
    const out = {};
    for (const sym of symbols) {
        try {
            const r = await get('https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?interval=1d&range=1mo');
            const res = r.chart && r.chart.result && r.chart.result[0];
            if (!res) continue;
            const ts = res.timestamp, c = res.indicators.quote[0].close;
            out[sym] = { close: +(+c[c.length - 1]).toFixed(3), date: new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10) };
        } catch (e) { /* abaikan */ }
    }
    console.log(JSON.stringify(out));
})();
