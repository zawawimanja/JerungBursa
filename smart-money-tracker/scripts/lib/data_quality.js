(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.JerungDataQuality = api;
})(typeof window === 'object' ? window : globalThis, function () {
    const normalize = value => String(value || '').trim().toUpperCase();
    const codeOf = value => normalize(value).replace(/\.KL$/, '');
    function assessStock(stock, { mappings = {}, now = Date.now(), snapshotAt, previous } = {}) {
        const issues = [];
        const add = (code, severity, message) => issues.push({ code, severity, message });
        const name = normalize(stock && stock.name);
        const mappedCode = codeOf(mappings[name]);
        const code = codeOf(stock && stock.code);
        const providerCode = codeOf(stock && stock.providerCode);
        if (!name || !Number.isFinite(stock && stock.price) || stock.price <= 0) add('INVALID_PRICE', 'reject', 'A stock name and positive finite price are required.');
        if (mappedCode && code && mappedCode !== code) add('SYMBOL_MISMATCH', 'reject', 'The quoted stock code contradicts the symbol mapping.');
        if (providerCode && code && providerCode !== code) add('PROVIDER_CODE_MISMATCH', 'reject', 'The market table and resolved quote identify different securities.');
        if (!code || !mappedCode) add('UNCONFIRMED_IDENTITY', 'warning', 'Stock identity has incomplete independent confirmation.');
        const provenance = { priceSource: stock && stock.provenance?.priceSource || null,
            observedAt: stock && stock.provenance?.observedAt || snapshotAt || null,
            quoteAt: stock && (stock.provenance?.quoteAt || stock.quoteAt) || null };
        for (const key of ['observedAt', 'quoteAt']) {
            if (!provenance[key]) { if (key === 'quoteAt') add('QUOTE_TIME_UNKNOWN', 'warning', 'The actual market quote time is unavailable.'); continue; }
            const time = Date.parse(provenance[key]);
            if (!Number.isFinite(time) || time > Number(now) + 5 * 60000) add('INVALID_TIME', 'reject', 'A quote or observation timestamp is invalid or in the future.');
            else if (key === 'quoteAt' && Number(now) - time > 24 * 3600000) add('OLD_QUOTE', 'warning', 'The market quote is more than one day old.');
        }
        if (!provenance.priceSource) add('SOURCE_UNKNOWN', 'warning', 'The price source is not recorded.');
        if (previous && previous.price > 0 && stock && stock.price > 0 &&
            (stock.price / previous.price > 1.5 || stock.price / previous.price < 0.5)) add('PRICE_JUMP', 'warning', 'A large price jump needs corporate-action or source confirmation.');
        if (stock && Number.isFinite(stock.change) && Number.isFinite(stock.changePct) &&
            stock.change !== 0 && stock.changePct !== 0 && Math.sign(stock.change) !== Math.sign(stock.changePct)) add('CHANGE_CONFLICT', 'warning', 'Absolute and percentage changes have conflicting directions.');
        const status = issues.some(i => i.severity === 'reject') ? 'reject' : issues.length ? 'warning' : 'verified';
        return { status, verified: status === 'verified', issues, identity: { code: code || null, symbol: mappedCode ? mappedCode + '.KL' : null }, provenance };
    }
    function evaluateSnapshot(raw, options = {}) {
        const issues = [], stocks = {};
        const now = options.now ?? Date.now();
        const timestamp = raw && Date.parse(raw.lastUpdated);
        if (!Number.isFinite(timestamp) || timestamp > Number(now) + 5 * 60000) issues.push({ code: 'INVALID_SNAPSHOT_TIME', severity: 'reject', message: 'Market snapshot time is invalid.' });
        for (const stock of [...(raw?.topVolume || []), ...(raw?.topGainers || [])]) {
            const name = normalize(stock && stock.name);
            if (Object.hasOwn(stocks, name)) continue;
            stocks[name] = assessStock(stock, { ...options, now, snapshotAt: raw?.lastUpdated });
        }
        const assessments = Object.values(stocks);
        const rejectedCount = assessments.filter(s => s.status === 'reject').length;
        const warningCount = assessments.filter(s => s.status === 'warning').length;
        if (!assessments.length) issues.push({ code: 'EMPTY_SNAPSHOT', severity: 'reject', message: 'No market quotes are available.' });
        return { status: rejectedCount || issues.length ? 'reject' : warningCount ? 'warning' : 'verified',
            issues, stockCount: assessments.length, rejectedCount, warningCount,
            verifiedCount: assessments.length - rejectedCount - warningCount, stocks };
    }
    function shouldUseDailyQuote(barAt, observedAt, currentPrice) {
        const bar = Date.parse(barAt), observed = Date.parse(observedAt);
        if (!Number.isFinite(bar) || !Number.isFinite(observed) || bar > observed + 5 * 60000) return false;
        const date = time => new Date(time + 8 * 3600000).toISOString().slice(0,10);
        return !(Number.isFinite(currentPrice) && currentPrice > 0) || date(bar) === date(observed);
    }
    function quoteMetadata(stock) {
        return {code:stock.code || null,providerCode:stock.providerCode || null,
            quoteAt:stock.quoteAt || null,barAt:stock.barAt || null,priceSource:stock.priceSource || null,dailyOHLC:stock.dailyOHLC || null};
    }
    return { assessStock, evaluateSnapshot, shouldUseDailyQuote, quoteMetadata };
});
