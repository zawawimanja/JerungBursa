(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CorporateRisk = api;
})(typeof window === 'object' ? window : globalThis, function () {
    const DAY_MS = 24 * 3600 * 1000;
    const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    function referenceDate(reference) {
        // Date-only inputs are calendar labels; timestamps use Malaysia time.
        if (typeof reference === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reference)) return new Date(reference + 'T00:00:00Z');
        const time = new Date(reference).getTime();
        return Number.isFinite(time) ? new Date(new Date(time + 8 * 3600000).toISOString().slice(0, 10) + 'T00:00:00Z') : null;
    }

    function parseEventDate(value, reference = new Date(), { pastOnly = false } = {}) {
        if (typeof value !== 'string') return null;
        const clean = value.trim().replace(/^(\d{1,2})-([a-z]{3,9})-(\d{4})$/i, '$1 $2 $3');
        const ref = referenceDate(reference);
        if (!ref || !Number.isFinite(ref.getTime())) return null;
        const short = /^(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{4}))?$/i.exec(clean);
        const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
        let day, month, year;
        if (short) {
            day = Number(short[1]);
            const token = short[2].toLowerCase();
            month = MONTHS.findIndex(m => token === m || token === m.slice(0, 3) || (m === 'september' && token === 'sept'));
            year = short[3] ? Number(short[3]) : null;
        } else if (iso) {
            year = Number(iso[1]); month = Number(iso[2]) - 1; day = Number(iso[3]);
        } else return null;
        if (month < 0 || month > 11 || day < 1 || day > 31 || (year !== null && year < 1000)) return null;
        const years = year !== null ? [year] : [ref.getUTCFullYear() - 1, ref.getUTCFullYear(), ref.getUTCFullYear() + 1];
        const dates = years.map(y => new Date(Date.UTC(y, month, day))).filter(d =>
            d.getUTCMonth() === month && d.getUTCDate() === day && (year !== null || !pastOnly || d <= ref));
        dates.sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref));
        return dates[0] || null;
    }

    function normalizeAnnouncements(announcements, reference = new Date(), { descending = false } = {}) {
        let cursor = reference;
        return (Array.isArray(announcements) ? announcements : []).filter(a => a && typeof a === 'object').map(ann => {
            const parsed = parseEventDate(ann.date, descending ? cursor : reference, { pastOnly: true });
            // Provider feeds are newest first: each missing year belongs to the latest date not after the preceding row.
            if (descending && parsed) cursor = parsed;
            return { ...ann, date: parsed ? parsed.toISOString().slice(0, 10) : ann.date };
        });
    }

    function isEarningsAnnouncement(announcement) {
        const title = String(announcement && announcement.title || '').toUpperCase();
        const category = String(announcement && announcement.category || '').trim().toUpperCase();
        if (/CHANGE.*FINANCIAL YEAR[\s-]*END/.test(title)) return false;
        return category === 'FINANCIAL RESULTS' || /\b(?:FINANCIAL|EARNINGS) RESULTS?\b|\bQUARTERLY\b.*\b(?:RPT|REPORT|RESULTS?)\b/.test(title);
    }

    function buildCorporateNewsRisk(announcements = [], entitlements = [], reference = new Date()) {
        announcements = normalizeAnnouncements(announcements, reference);
        entitlements = Array.isArray(entitlements) ? entitlements.filter(e => e && typeof e === 'object') : [];
        const ref = referenceDate(reference);
        const newsBadges = [];
        const addBadge = (type, label, severity, title) => {
            if (!newsBadges.some(b => b.type === type)) newsBadges.push({ type, label, severity, title });
        };
        const dayDifference = date => {
            const parsed = parseEventDate(date, reference);
            return parsed && ref ? Math.round((parsed - ref) / DAY_MS) : null;
        };

        // Inspect every dividend, because the first row can be expired or undated.
        const relevantDividends = entitlements.filter(e => e.isDividend).map(ent => ({ ent, days: dayDifference(ent.exDate) }))
            .filter(e => e.days !== null && e.days >= -5 && e.days <= 30)
            .sort((a, b) => (a.days < 0) - (b.days < 0) || Math.abs(a.days) - Math.abs(b.days));
        if (relevantDividends.length) {
            const ent = relevantDividends[0].ent;
            addBadge('EX_DIVIDEND', `Ex-Div: ${ent.exDate}`, 'warning', `${ent.type} (${ent.amount || 'Dividend'}) | Ex-Date: ${ent.exDate}`);
        }

        const recent = announcements.map(ann => ({ ann, days: dayDifference(ann.date) }))
            .filter(a => a.days !== null && a.days >= -30 && a.days <= 10)
            .sort((a, b) => b.days - a.days);
        for (const { ann, days } of recent) {
            const title = String(ann.title || '').toUpperCase();
            const category = String(ann.category || '').toUpperCase();
            const detail = `[${ann.date}] ${ann.title || ''}`;
            if (days <= 0) {
                if (/\bBYD\b|MEMORANDUM OF UNDERSTANDING|\bMOU\b|PARTNERSHIP|ELECTRIC VEHICLE|EV BUS|GREEN MOBILITY|SOLAR|RENEWABLE/.test(title)) {
                    addBadge('EV_CATALYST', '⚡ MOU / EV Catalyst', 'success', detail);
                }
                if (/ARTIFICIAL INTELLIGENCE|DATA CENTRE|\bNVIDIA\b|\bCHIPS?\b|SEMICONDUCTOR/.test(title)) {
                    addBadge('AI_CATALYST', '🤖 AI / Data Centre', 'success', detail);
                }
                if (/LETTER OF AWARD|CONTRACT AWARD|PROJECT AWARD/.test(title) || (/CONTRACT/.test(title) && /AWARD/.test(title))) {
                    addBadge('CONTRACT_WIN', '📜 Contract Award', 'success', detail);
                }
                if (/SUBSTANTIAL|SECTION 138|ACQUISITION OF SHARES/.test(title) || category.includes('CHANGES IN SHAREHOLDINGS')) {
                    addBadge('JERUNG_5PCT', '🐋 Major Shareholder Activity', 'info', detail);
                }
                if (/SHAREHOLDINGS|SUBSTANTIAL/.test(title)) addBadge('SHAREHOLDING', 'Insider Action', 'info', detail);
            }
            if (days >= -7 && isEarningsAnnouncement(ann)) addBadge('EARNINGS_QR', 'Earnings Release', 'danger', detail);
            if (/RIGHTS ISSUE|PRIVATE PLACEMENT|BONUS ISSUE/.test(title)) addBadge('CORP_ACTION', 'Corp Action', 'danger', detail);
        }
        if (!newsBadges.length && recent.some(a => a.days <= 0)) {
            const ann = recent.find(a => a.days <= 0).ann;
            addBadge('RECENT_NEWS', `News: ${ann.date}`, 'info', `[${ann.date}] ${ann.category || ''} - ${ann.title || ''}`);
        }
        return {
            hasNewsAlert: newsBadges.some(b => ['EX_DIVIDEND', 'EARNINGS_QR', 'CORP_ACTION'].includes(b.type)),
            newsBadges, announcements, entitlements
        };
    }

    return { parseEventDate, normalizeAnnouncements, isEarningsAnnouncement, buildCorporateNewsRisk };
});
