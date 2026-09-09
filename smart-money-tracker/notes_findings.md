# 📝 Arkib Penemuan & Pembelajaran Setup Tapak Tegar (Golden Zone)

Dokumen ini mengarkibkan penemuan penting daripada sesi debugging, kuiz, dan pengesahan formula tapisan saham "Tapak Tegar" (Golden Zone) untuk rujukan masa hadapan.

---

## 1. Kepentingan Syarat Wajib: ATH & 52-Week High
* **Sebab:** Untuk menapis keluar saham downtrend atau saham bernilai rendah yang tiada sokongan institusi.
* **Kriteria:** Pullback harga semasa berbanding puncak 52-Week High / ATH mestilah $\le$ 15.0%.
* **Hasil:** Hanya kaunter berasaskan pengumpulan tinggi (High Base Accumulation) seperti setup lagenda OGX, KEEMING, dan HKB yang dibenarkan masuk ke Zon Emas.

---

## 2. Kes Pembelajaran 1: MMCS (0456)
* **Isu Utama (Missed Setup):** MMCS membina zon pengumpulan terbaik antara 19-29 Jun 2026 sekitar RM 0.260 - 0.270 sebelum breakout pada 30 Jun (+7.55%), tetapi tidak masuk dalam scanner.
* **Punca:** Sebagai IPO baru, MMCS mempunyai sejarah dagangan singkat (< 13 hari). Lantai 10-hari asalnya mengira harga terendah hari pertama listing (RM 0.215) sebagai lantai mutlak. Ini menyebabkan jarak harga semasa ke lantai dikira melebihi +20% (had maksimum scanner adalah $\le$ 3%).
* **Penyelesaian (Smarter Dynamic Lookback):**
  * Bagi kaunter IPO/muda dengan **sejarah < 25 hari dagangan**, sistem ditukar menggunakan lookback **5 hari** sahaja.
  * Hasilnya, lantai MMCS dilaraskan dengan cepat ke RM 0.255, dan sistem berjaya mengesan isyarat kemasukan terbaik (Golden Setup) secara tepat pada **26 Jun 2026** (Close: RM 0.260 | Jarak ke Lantai: +1.96% | Sentuhan: 5x).

---

## 3. Kes Pembelajaran 2: KEEMING (0392)
* **Isu Utama (Kenapa 15-19 Jun 2026 Tidak Tergolong?):**
  * Walaupun pullback berada dalam keadaan sihat (3.57% - 6.43% dari puncak), ia gagal melepasi tapisan atas dua sebab:
    1. **CloseTightness Bocor:** Pada 15 & 16 Jun, harga penutup masih liar/volatile (`CloseTightness` masing-masing 18.02% & 14.53% berbanding SOP $\le$ 5.5%).
    2. **TouchCount Rendah:** Pada 18 & 19 Jun, sentuhan lantai hanya **2x** kerana lantai harian minimum 10-hari masih dipegang oleh RM 1.030 sedangkan harga terendah semasa adalah sekitar RM 1.240.
  * **Pembelajaran:** Saham memerlukan masa rehat yang mencukupi untuk menstabilkan volatiliti penutup dan menguji lantai baru (TouchCount $\ge$ 3x) sebelum boleh diklasifikasikan sebagai tapak yang selamat untuk kemasukan swing.

---

## 4. Kes Pembelajaran 3: ADNEX (0396)
* **Pencetus Golden Setup:** **20 Mei 2026**
  * Close: RM 0.290 | Pullback: **6.45%** (Near ATH) | CloseTightness: **5.17%** | Sentuhan: **8x** | Jarak ke Lantai: **0.00%** (Rapat di lantai RM 0.290).
* **Hasil Pasca-Setup:** Pada keesokan harinya (21 Mei), harga memecah lantai sokongan ke bawah dan ditutup pada RM 0.285 (kejatuhan -1.79% dengan lantai baru RM 0.280).
* **Pembelajaran:** Ini adalah contoh setup yang gagal bertahan di lantai sokongan dan memicu Stop Loss ketat (3% di bawah lantai). Kawalan risiko (Stop Loss) adalah sangat kritikal kerana jika lantai RM 0.290 bocor, bermakna fasa pengumpulan jerung dibatalkan.

---

## 5. Kes Pembelajaran 4: MCLEAN (0167)
* **Pencetus Golden Setup:** **27 Mei 2026**
  * Close: RM 0.580 | Pullback: **13.43%** dari puncak RM 0.670 | CloseTightness: **4.31%** (Bawah had 5.5% 🟢) | Sentuhan: **3x** | Jarak ke Lantai: **+1.75%** (Rapat di atas lantai RM 0.570).
* **Hasil Pasca-Setup (Rally Bersih & Pantas):**
  * **28 Mei (Keesokan hari):** Terus ditutup pada **RM 0.620** (+6.9% kenaikan).
  * **29 Mei (Hari ke-2):** Meletup ke puncak RM 0.690 dan ditutup pada **RM 0.655** (+12.9% - melepasi TP1 +10%).
  * **09 Jun (Hari ke-8):** Mencapai puncak tertinggi pada **RM 0.715** (**+23.2%** dari entry - melepasi TP2 +20% sepenuhnya tanpa menyentuh Stop Loss).
* **Pembelajaran:** Ini adalah contoh terbaik keberkesanan formula Zon Emas. Apabila kaunter mengumpul tenaga berhampiran puncak 52W High dengan kerapatan yang padat dan tapak yang kukuh, breakout yang berlaku adalah sangat agresif dan terus menghasilkan profit pantas.

---

## 6. Kes Pembelajaran 5: TMK (5330)
* **Isu Utama (Staircase Breakout Skew):** TMK berada dalam fasa pengumpulan yang sangat cantik di atas "tangga baru" dari **23 April hingga 18 Mei 2026**. Namun, ia gagal dikesan oleh scanner standard 10-hari.
* **Punca:** Selepas breakout dari RM 1.62 ke RM 1.73 (tapak bertingkat), TMK mula membina tapak baru di paras RM 1.68. Namun, lantai 10-hari masih merekodkan harga terendah dari tangga lama (RM 1.60). Ini menyebabkan jarak ke lantai dikira sebagai 5.0% (melebihi had $\le$ 3.0%), walaupun ia sebenarnya sangat rapat dengan lantai baru RM 1.64.
* **Penyelesaian Mutlak (Dual-Window Floor):**
  * Kita memperkenalkan formula **Dual-Window Floor (10-Day & 5-Day)**.
  * Jika lantai 10-hari terlampau jauh ($>3.0\%$) tetapi lantai 5-hari adalah rapat ($\le 3.0\%$) dan mempunyai sokongan padat (TouchCount $\ge 3x$ dalam 10 hari lepas), sistem secara automatik melaraskan lantai ke paras 5-hari yang baru.
  * Dengan formula ini, TMK berjaya dikesan secara tepat pada **12 Mei 2026** (Close: RM 1.680 | Lantai Baru: RM 1.640 | Jarak: +2.44% | Kerapatan: 0.60% | Sentuhan: 8x).
* **Hasil Pasca-Setup (Multi-Bagger 60%+):**
  * **19 Mei:** Naik ke RM 1.850 (+10.1% - TP1).
  * **22 Mei:** Naik ke RM 1.930 (+14.8%).
  * **22 Jun:** Mencecah puncak tertinggi pada **RM 2.750** (Kenaikan maksima **+63.7%** dari harga entry kita pada RM 1.680!).

---

## 7. Kes Pembelajaran 6: Perbezaan Setup 'ADD-ON Berkuasa' (STRATUS) vs 'ADD-ON Lemau' (AMS) & SOP Pemilihan Top Ranking
* **Isu Utama:** Kedua-dua AMS dan STRATUS muncul dalam scanner Fresh Rider / Top Ranking dengan status `➕ ADD-ON`, tetapi hanya STRATUS yang layak dibeli, manakala AMS wajib dielakkan (*Jangan Beli*).
* **Punca & Perbandingan Mendalam:**
  1. **Kecairan / Turnover Jerung:**
     * **STRATUS:** Turnover harian mencecah **RM 6.23 Juta** (Top 4 paling aktif transaksi di seluruh pasaran Bursa Malaysia). Duit jerung institusi sangat aktif mengalir masuk.
     * **AMS:** Turnover hanya **RM 1.40 Juta** (semalam cuma RM 711k). Tiada momentum institusi aktif, pergerakan terlalu perlahan (*slow grinder / lemau*).
  2. **Kerapatan Squeeze (Spring Energy):**
     * **STRATUS:** `closeTightness = 1.08%` (Ultra-mampat, spring ditekan habis sebelum letupan).
     * **AMS:** `closeTightness = 3.33%` (3x ganda lebih longgar).
  3. **Kesegaran Fasa (Stage of Base):**
     * **STRATUS:** Saham muda berumur **50 hari dagangan** (IPO 21 Julai 2026, Gred A). Sedang membina tangga baru (Base 2) selepas rehat pertama.
     * **AMS:** Saham berumur **139 hari** (IPO April 2026, Gred B). Sudah 68 hari dagangan tersadai di paras sama sejak entry Jun 2026.
  4. **Pullback Borderline:**
     * **AMS:** Pullback 9.8% (berada di hujung tanduk had maksimum $\le 10.0\%$). Turun setengah sen sahaja akan terus gugur keluar dari scanner.
     * **STRATUS:** Pullback sihat di Base 2 dengan risiko Stop Loss hanya **2.89%** (Entry RM 2.760 vs SL RM 2.680).
* **SOP Pemilihan Harian (Golden Rules):**
  * **Prioriti 1:** Selalu utamakan kaunter bertanda **`🆕 NEW` (Day 1)** seperti PENTECH (08-09 Sep 2026).
  * **Syarat Ambil `➕ ADD-ON`:** Hanya ambil jika Turnover $\ge$ RM 3.0 Juta, Tightness $\le 2.0\%$, dan risiko SL $\le 5\%$ (seperti STRATUS).
  * **Pantang Larang:** JANGAN ambil `ADD-ON` yang lemau (Turnover < RM 2.0M, umur lama > 100 hari, pullback tepi jurang > 9.5%) seperti AMS walaupun skornya 100.



