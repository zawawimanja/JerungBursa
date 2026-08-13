// Backtest THMY dari IPO (23-Okt-2025): bolehkah "detect awal" tangkap ~133%?
// Peraturan detect (mirip logik scanner Jerung Bursa, fokus fresh IPO bawah RM1):
//   1. Fresh IPO (tahun 2025).
//   2. Harga masih bawah RM1 (peringkat awal / base).
//   3. Base padat: >= 3 sentuhan lantai (low hampir 20-hari low) dalam 20 hari.
//   4. Tutup dekat lantai (jarak <= 6%) = risiko rapat, SL ketat.
//   -> BUY pada hari pertama semua syarat dipenuhi.
// Ride + Trailing Stop: SL 3% bawah puncak tertinggi selepas entry.
const fs = require('fs');

(async () => {
  const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/0375.KL?range=2y&interval=1d', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const j = await r.json();
  const res = j.chart.result[0];
  const ts = res.timestamp, q = res.indicators.quote[0];
  const days = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close[i] == null) continue;
    days.push({ d: new Date(ts[i] * 1000).toISOString().slice(0, 10), o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] });
  }
  const N = days.length;

  // ---- DETECT AWAL: cari entry dalam fasa base bawah RM1 ----
  let entryDay = null, entryPrice = null, floor = null;
  for (let i = 20; i < N; i++) {
    if (days[i].c >= 1.0) continue;                 // mesti bawah RM1 (peringkat awal)
    // base 20 hari
    const win = days.slice(i - 20, i);
    const low20 = Math.min(...win.map(d => d.l));
    // kira sentuhan lantai: low dalam 1.5% dari low20
    const touches = win.filter(d => d.l <= low20 * 1.015).length;
    const dist = (days[i].c - low20) / low20 * 100;
    // syarat: base matang (>=3 sentuhan), tutup dekat lantai (<=6%), masih bawah RM1
    if (touches >= 3 && dist >= 0 && dist <= 6.0) {
      entryDay = i; entryPrice = days[i].c; floor = low20; break;
    }
  }

  if (entryDay == null) { console.log('Tiada entry bawah RM1 ditemui'); return; }

  console.log('=== DETECT AWAL THMY ===');
  console.log('IPO: 23-Okt-2025 @ RM0.31 (debut tutup 0.91)');
  console.log('BUY dikesan:', days[entryDay].d, '@ RM', entryPrice.toFixed(3));
  console.log('Lantai (low 20-hari):', floor.toFixed(3), '| jarak:', ((entryPrice - floor)/floor*100).toFixed(1)+'%');

  // ---- RIDE + TRAILING STOP (SL 3% bawah puncak) ----
  const SL = 0.03;
  let peak = entryPrice, peakDay = entryDay;
  let exitDay = null, exitPrice = null;
  for (let i = entryDay + 1; i < N; i++) {
    if (days[i].c > peak) { peak = days[i].c; peakDay = i; }
    if (days[i].c < peak * (1 - SL)) { exitDay = i; exitPrice = days[i].c; break; }
  }
  if (exitDay == null) { exitDay = N - 1; exitPrice = days[N - 1].c; }
  const ret = (exitPrice - entryPrice) / entryPrice * 100;
  const peakRet = (peak - entryPrice) / entryPrice * 100;

  console.log('\n=== RIDE + TRAILING STOP ===');
  console.log('Puncak selepas entry:', days[peakDay].d, '@ RM', peak.toFixed(3), '(+' + peakRet.toFixed(1) + '%)');
  console.log('Exit (trailing 3%):', days[exitDay].d, '@ RM', exitPrice.toFixed(3));
  console.log('PULANGAN DITANGKAP: +' + ret.toFixed(2) + '%');

  console.log('\n=== PERBANDINGAN ===');
  console.log('Dari entry awal RM' + entryPrice.toFixed(3) + ' ke puncak RM' + peak.toFixed(3) + ' = +' + peakRet.toFixed(1) + '%');
  console.log('Matlamat Sifu (+133.53%) dari entry ~0.86: ', (133.53).toFixed(2) + '%');
  console.log('Dari IPO RM0.31 ke puncak RM' + peak.toFixed(3) + ' = +' + ((peak - 0.31)/0.31*100).toFixed(1) + '%');

  // Cetak fasa base sekitar entry
  console.log('\n--- sekitar entry ---');
  for (let i = Math.max(0, entryDay - 3); i <= Math.min(N - 1, entryDay + 5); i++) {
    console.log(days[i].d, 'C', days[i].c.toFixed(3), 'V', (days[i].v/1e6).toFixed(1)+'M', i === entryDay ? '<<< BUY' : '');
  }
})();
