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
│       ├── buy-alert.yml           # Notifikasi Telegram Isyarat Belian
│       └── morning-alert.yml       # Notifikasi Telegram Ringkasan Pagi
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
    │   ├── buy_alert.js            # Bot Notifikasi Belian Telegram
    │   ├── morning_alert.js        # Bot Notifikasi Pagi Telegram
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
   * Menjalankan `scrape-real.js` -> `generate_fresh_rider_tracker.js` -> `generate_hot_theme_tracker.js` -> `generate_daily_equity_tracker.js`.
   * Menjana fail data terkini secara automatik dan menolak (*push*) terus ke cawangan `main`.
3. **Penyampaian Web (Vercel)**:
   * Routing dikawal oleh `vercel.json` di mana semua data `.js` / `.json` disajikan dengan header `no-cache` untuk memastikan paparan web sentiasa real-time.

---

## 🛡️ Peraturan Keselamatan Pembangunan (SOP)
* **Jangan ubah nama atau lokasi fail data teras**: (`live_data.js`, `fresh_rider_tracker.js`, `hot_theme_tracker.js`, `daily_equity_tracker.js`) kerana ia dipautkan secara langsung kepada skrip automasi GitHub Actions, Vercel routes, dan Telegram Bot.
* **Prinsip Semakan 3-Sudut**: Setiap kemaskini formula atau paparan mesti mengesahkan:
  1. Backend Generator (`smart-money-tracker/scripts/`)
  2. Frontend UI (`smart-money-tracker/index.html`)
  3. Telegram Bot (`buy_alert.js`, `morning_alert.js`)
