# 🦈 JerungBursa / Smart Money Tracker

> **JerungBursa** adalah platform imbasan dan penjejakan pergerakan "Smart Money" / "Jerung" di Pasaran Saham Bursa Malaysia.

---

## 📂 Structure Direktori Projek (Folder Map)

```text
JerungBursa/
├── .agents/                        # Dynamic rules & master memory projek (AGENTS.md)
├── .github/
│   └── workflows/                  # GitHub Actions for automated cron scrapers
│       ├── scrape-bursa.yml        # Imbasan data live setiap 10 minit (Waktu Dagangan)
│       └── buy-alert.yml           # Notifikasi Telegram Isyarat Belian (Selepas Pasaran Tutup)
│
├── vercel.json                     # Konfigurasi Vercel Routing & Serverless Functions
├── package.json                    # Root dependencies (Axios, dsb)
├── README.md                       # Dokumentasi struktur & operasi projek
│
└── smart-money-tracker/            # Root Aplikasi Web Utama (Serves via Vercel)
    ├── api/                        # Serverless Functions (Vercel Node)
    │   ├── chat.js                 # API Pembantu AI Chatbot
    │   └── cron-scrape.js          # Handler Webhook & Cron Scraper
    │
    ├── scripts/                    # Skrip Enjin Backend & Generasi Data
    │   ├── scrape-real.js          # Skrip imbasan harga live Bursa Malaysia
    │   ├── generate_fresh_rider_tracker.js    # Enjin Jana Isyarat Fresh Rider
    │   ├── generate_hot_theme_tracker.js      # Enjin Jana Isyarat Hot Theme
    │   ├── generate_daily_equity_tracker.js   # Penjejak Ekuiti Harian & Portfolio
    │   ├── generate_news_data.js   # Pengumpul Berita & Sentimen Pasaran
    │   ├── buy_alert.js            # Bot Notifikasi Belian Telegram (Post-Close)
    │   └── portfolio_alert.js      # Bot Penjejak Portfolio Telegram
    │
    ├── history/                    # Arkib JSON Snapshot Data Harian (cth: data_2026-09-30.json)
    ├── articles/                   # Artikel Edukasi & Analisis Pasaran
    ├── assets/                     # Fail Statik (Gambar, CSS, JS sokongan)
    ├── docs/                       # Dokumentasi Teknikal Tambahan
    ├── scratch/                    # Skrip Ujian / Simulasi Tempatan (Ignored in Git)
    │
    ├── index.html                  # Dashboard Utama JerungBursa
    ├── jerung-radar.html           # Radar Imbasan Jerung & Confluence Matrix
    ├── hall-of-fame.html           # Rekod Pencapaian & Backtest Saham Winner
    ├── formula.html                # Penerangan Logik & Formula Strategi
    ├── sop.html                    # Standard Operating Procedure (SOP) Dagangan
    ├── articles.html               # Pusat Artikel & Analisis
    ├── about.html                  # Maklumat Platform
    ├── contact.html                # Borang Hubungi
    ├── privacy-policy.html         # Dasar Privasi (Google AdSense Ready)
    └── terms.html                  # Terma & Syarat
```

---

## ⚡ Enjin Automation & Workflow

1. **Pasaran Tutup & Stabil**:
   * Data rasmi Yahoo Finance / Bursa disahkan stabil antara **5:50 PM - 6:05 PM (MYT)**.
2. **GitHub Actions (`scrape-bursa.yml`)**:
   * Menjalankan `run_market_pipeline.js`: harga -> berita -> Fresh Rider -> Hot Theme -> ekuiti harian -> radar jerung. Updater lokal menggunakan aliran yang sama setiap 5 minit.
   * Menjana fail data terkini secara automatik dan menolak (*push*) terus ke cawangan `main`.
3. **Penyampaian Web (Vercel)**:
   * Routing dikawal oleh `vercel.json` di mana semua data `.js` / `.json` disajikan dengan header `no-cache` untuk memastikan paparan web sentiasa real-time.
   * Dashboard menyemak snapshot hos dan GitHub setiap **5 minit**; scraper cloud dijadualkan setiap **10 minit**. Harga, tracker dan berita disegarkan bersama apabila ada snapshot baharu.
   * `Last Updated` ialah masa snapshot data (MYT), manakala `Last checked` ialah masa semakan browser. Status `Data delayed` muncul apabila snapshot melebihi 20 minit dalam waktu kemas kini.
   * `npm test` menyemak aliran refresh dan integriti tracker. Saham boleh beralih daripada `OPEN` kepada `CLOSED_SL` / `CLOSED_TIME`; audit tidak memaksa saham tertentu kekal `OPEN`.
   * Semua generator menggunakan tarikh Malaysia, mengganti snapshot pada hari yang sama dan memainkan semula sejarah mengikut turutan tarikh.
   * Tracker dan berita disemak semula walaupun timestamp harga tidak berubah, supaya pembetulan data tetap masuk ke dashboard.

## Operasi & Semakan

* Runtime scraper: **Node.js 22.12 atau lebih baharu**. `npm ci` di `smart-money-tracker` memasang browser Chrome yang sepadan dengan Puppeteer. Tetapkan `PUPPETEER_EXECUTABLE_PATH` hanya jika mahu menggunakan browser sendiri.
* Jalankan `npm test` dari root untuk regression tests dan audit scanner/tracker. Ujian menggunakan transport palsu dan tidak menghantar Telegram atau menjalankan scraper sebenar.
* Cron API memerlukan `CRON_SECRET` serta `GITHUB_TOKEN` atau `GH_PAT`. Panggilan mesti membawa `Authorization: Bearer <CRON_SECRET>`; secret yang belum diset menyebabkan respons 503. Dashboard membaca snapshot secara automatik; penerbitan data dikawal oleh scheduler.
* Jika sumber berita gagal, data terakhir yang berjaya dikekalkan untuk sumber tersebut. Metadata `fetchStatus` / `lastSuccessfulAt` membezakan kegagalan semakan daripada hasil berita kosong.
* Sejarah notifikasi portfolio lokal disimpan dalam `portfolio_alerts_state.json` yang diabaikan Git. Milestone hanya direkodkan selepas Telegram mengesahkan penghantaran; fail lama `portfolio_alerts_history.json` dibaca sebagai seed sahaja.
* `npm run test:e2e` menyemak 16 tab, filter, arkib, portfolio, kalkulator, AI fallback dan paparan telefon dengan request luar disekat atau diganti. Windows boleh menggunakan Edge sedia ada; platform lain menggunakan browser Playwright. `E2E_BROWSER_PATH` boleh ditetapkan untuk browser sendiri.
* `npm run data:quality` membezakan rekod bercanggah daripada metadata yang belum dapat disahkan. Masa pengumpulan snapshot berbeza daripada masa quote sebenar; bar Yahoo lama tidak menimpa harga sesi semasa yang sah.
* Formula Fresh Rider / Hot Theme utama dan penjelasan penolakan dikongsi melalui `scripts/lib/strategy_rules.js`, termasuk had ranking dan profil NEW / ADD-ON yang berbeza mengikut konteks.
* **Guide** memaparkan status data dan sebab kaunter tidak muncul. **Tracker Daily** memuatkan ekuiti penuh serta kajian T+1 apabila dibuka. `scanner_history.js` mengekalkan unjuran lantai yang sama dengan payload kecil untuk paparan awal.
* Kajian T+1 (`execution_backtest.js`) menggunakan signal daripada snapshot hari berkenaan, limit pada harga signal, lot bulat, kos boleh laras dan slippage. Kos ialah andaian ilustrasi, bukan sebut harga broker. Tanpa OHLC, keputusan ditanda anggaran harga tutup / fill belum disahkan; jumlah PnL signal bebas bukan pulangan portfolio berkapasiti tetap.
* Arkib berita baharu `history/news_*.json` merekodkan masa penerimaan sebenar. Kajian hanya menggunakan berita yang sudah diketahui sebelum signal; sejarah lama tanpa arkib kekal **unknown**. Data signal yang direkodkan selepas keputusan pra-pembukaan T+1 dikecualikan.
* Workflow `test-dashboard.yml` menjalankan ujian unit dan desktop/telefon untuk perubahan kod. Pembaikan kod dan kajian tidak mengesahkan penghantaran Telegram atau API provider production.

---

## 🛡️ Peraturan Keselamatan Pembangunan (SOP)
* **Jangan ubah nama atau lokasi fail data teras**: (`live_data.js`, `fresh_rider_tracker.js`, `hot_theme_tracker.js`, `daily_equity_tracker.js`) kerana ia dipautkan secara langsung kepada skrip automasi GitHub Actions, Vercel routes, dan Telegram Bot.
* **Prinsip Semakan 3-Sudut**: Setiap kemaskini formula atau paparan mesti mengesahkan:
  1. Backend Generator (`smart-money-tracker/scripts/`)
  2. Frontend UI (`smart-money-tracker/index.html`)
  3. Telegram Bot (`buy_alert.js`, `portfolio_alert.js`)
