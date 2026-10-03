/**
 * bursa_calendar.js
 * 
 * Kalendar Cuti Rasmi & Semakan Hari Dagangan Bursa Malaysia
 * Dipusatkan untuk kegunaan semua skrip & tracker JerungBursa.
 */

const BURSA_MALAYSIA_HOLIDAYS = new Set([
    // === 2025 ===
    '2025-01-01', // New Year
    '2025-01-29', '2025-01-30', // Chinese New Year
    '2025-02-01', '2025-02-03', // FT Day & Replacement
    '2025-02-11', // Thaipusam
    '2025-03-18', // Nuzul Quran
    '2025-03-31', '2025-04-01', // Hari Raya Aidilfitri
    '2025-05-01', // Labour Day
    '2025-05-12', // Wesak Day
    '2025-06-02', // Agong's Birthday
    '2025-06-06', // Hari Raya Haji
    '2025-06-27', // Awal Muharram
    '2025-08-31', '2025-09-01', // National Day & Replacement
    '2025-09-05', // Maulidur Rasul
    '2025-09-16', // Malaysia Day
    '2025-10-20', // Deepavali
    '2025-12-25', // Christmas

    // === 2026 ===
    '2026-01-01', // New Year's Day
    '2026-02-01', '2026-02-02', // Thaipusam / FT Day & Replacement
    '2026-02-17', '2026-02-18', // Chinese New Year (17 & 18 Feb 2026)
    '2026-03-08', '2026-03-09', // Nuzul Al-Quran & Replacement
    '2026-03-20', '2026-03-21', '2026-03-22', '2026-03-23', // Hari Raya Aidilfitri
    '2026-05-01', // Labour Day
    '2026-05-27', // Hari Raya Haji / Aidiladha
    '2026-05-31', '2026-06-01', // Wesak Day / Agong's Birthday & Replacement
    '2026-06-17', // Awal Muharram
    '2026-08-25', // Maulidur Rasul
    '2026-08-31', // Hari Kebangsaan (National Day)
    '2026-09-16', // Hari Malaysia (Malaysia Day)
    '2026-11-08', '2026-11-09', // Deepavali & Replacement
    '2026-12-25', // Christmas Day

    // === 2027 ===
    '2027-01-01', // New Year's Day
    '2027-01-22', // Thaipusam
    '2027-02-01', // Federal Territory Day
    '2027-02-06', '2027-02-07', '2027-02-08', // Chinese New Year & Replacement
    '2027-02-25', // Nuzul Al-Quran
    '2027-03-10', '2027-03-11', // Hari Raya Aidilfitri
    '2027-05-01', '2027-05-03', // Labour Day & Replacement
    '2027-05-16', '2027-05-17', // Hari Raya Haji & Replacement
    '2027-05-20', // Wesak Day
    '2027-06-06', '2027-06-07', // Awal Muharram & Agong's Birthday
    '2027-08-15', // Maulidur Rasul
    '2027-08-31', // Hari Kebangsaan
    '2027-09-16', // Hari Malaysia
    '2027-10-29', // Deepavali
    '2027-12-25'  // Christmas Day
]);

/**
 * Sahkan sama ada sesuatu tarikh (YYYY-MM-DD) merupakan hari dagangan Bursa yang sah.
 * Menapis Sabtu, Ahad, dan cuti umum rasmi Bursa Malaysia.
 * 
 * @param {string} dateStr Format YYYY-MM-DD
 * @returns {boolean}
 */
function isTradingDay(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const cleanDate = dateStr.slice(0, 10);
    if (BURSA_MALAYSIA_HOLIDAYS.has(cleanDate)) return false;
    const d = new Date(cleanDate + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    const wd = d.getDay();
    return wd !== 0 && wd !== 6;
}

module.exports = {
    BURSA_MALAYSIA_HOLIDAYS,
    isTradingDay
};
