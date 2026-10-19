# Pelan Pelaksanaan: Pembaikan 4 Bug & Penambahbaikan Tab Fresh Rider (FR) & Hot Theme (HT)

Pelan ini melaksanakan kesemua 4 pembaikan dan penambahbaikan pada tab **🔥 Fresh Rider (FR)** dan **⚡ Hot Theme (HT)** tanpa mengubah reka letak asas papan pemuka sedia ada:

---

## 1. Pembaikan Navigasi Klik Lencana `LIVE TRACKER PNL` Atas (`smart-money-tracker/index.html`)
- **Baris FR (`#navFrGcPnlBadge`)**: Menukar panggilan `onclick` daripada `navigateToLiveTracker('all')` kepada `navigateToLiveTracker('golden')` dan mengemas kini `navigateToLiveTracker()` supaya menyokong mod `'golden'`.
- **Baris HT (`#navHtPnlBadge`, `#navHtGcPnlBadge`, `#navHtNewPnlBadge`, `#navHtAddonPnlBadge`, `#navHtFloorPnlBadge`)**: Mengemas kini panggilan `onclick` kepada `navigateToLiveTracker('ht_all')`, `'ht_golden'`, `'ht_new'`, `'ht_addon'`, dan `'ht_floor'` supaya apabila diklik, ia terus membuka tab **Hot Theme**, menukar sub-tab melalui `switchHtTrackerSubTab()`, dan menatal ke jadual **Hot Theme Live Tracker**.

---

## 2. Penyelarasan Tapisan `👑 Golden Combo` di Tab Hot Theme (`smart-money-tracker/index.html`)
- Mengemas kini fungsi `getTierOfHT()` supaya memulangkan nilai `isRealUpperWickDump` (sama seperti `getTierOfFR()`).
- Menambah syarat `!t.isRealUpperWickDump` pada penapis `htFilter === 'golden_combo'` serta lencana `isGoldenComboHT` supaya kaunter yang mengalami tekanan jualan jarum atas merah (*red upper-wick dump*) tidak terlepas masuk ke dalam senarai **Golden Combo (A++)**.

---

## 3. Paparan *Win Rate %* & *Avg Gain %* Mengikut Sub-Tab dalam `Live Tracker` (`smart-money-tracker/index.html`)
- Mengemas kini `renderFreshRiderTracker()` dan `renderHotThemeTracker()` supaya mengira semula statistik **Win Rate (%)** dan **Purata Pulangan / Dagangan (`Avg Gain %`)** secara tepat bagi mana-mana sub-tab yang dipilih (`🌟 ALL`, `🔥 NEW`, `⭐ ADD-ON A+`, `🛡️ LANTAI RAPAT`, dan `👑 Golden Combo`).
- Menambah kad **🏆 Win Rate & Avg Gain** pada bar statistik `#frTrackerStats` dan `#htTrackerStats` supaya anda dapat melihat kadar kemenangan sebenar setiap sub-strategi dengan serta-merta.

---

## 4. Penyelarasan Ranking Dinamik dalam `LIVE FORWARD TEST: Top 4 Entry Strategies` (`smart-money-tracker/index.html`)
- Mengemas kini fungsi `renderDynamicQuantStudies()` supaya:
  - Mengira prestasi merangkumi keseluruhan dagangan (*All Tracked: Closed + Open*) di samping metrik *Closed*, supaya pemenang besar yang masih aktif (*OPEN* seperti *KEEMING* dan *BUSCAP*) tidak diabaikan.
  - Menyusun dan memberikan lencana kedudukan (`🏅 No 1`, `🥈 No 2`, `🥉 No 3`, `📊 No 4`) secara **dinamik mengikut *Profit Factor* & *Win Rate* sebenar**, menghapuskan label *hardcoded* yang bercanggah.

---

## 5. Pengesahan & Ujian Automatik
- Menjalankan ujian unit dan audit penyegerakan (`npm test` dalam `smart-money-tracker`) serta `compile_applet` bagi memastikan kesemua 103 ujian unit dan 19 semakan penyegerakan lulus 100%.
