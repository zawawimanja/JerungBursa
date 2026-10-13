// Audit structural invariants, not a fixed list of stocks that must stay OPEN.
function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function trackerIssues(tracker) {
    if (!tracker || !Array.isArray(tracker.trades) || !tracker.summary) return ['Missing trades or summary'];
    const issues = [];
    const ids = new Set();
    for (const t of tracker.trades) {
        const label = t && `${t.name || '?'} ${t.entryDate || '?'}`;
        if (!t || !t.name || !['OPEN', 'CLOSED_SL', 'CLOSED_TIME'].includes(t.status)) {
            issues.push(`${label}: invalid name/status`);
            continue;
        }
        const id = t.id || `${t.name}_${t.entryDate}_${t.entryType}`;
        if (ids.has(id)) issues.push(`${label}: duplicate entry`);
        ids.add(id);
        for (const key of ['entry', 'currentPrice', 'high']) {
            if (!Number.isFinite(t[key]) || t[key] <= 0) issues.push(`${label}: invalid ${key}`);
        }
        if (!Number.isFinite(t.finalGain)) issues.push(`${label}: invalid finalGain`);
        if (Number.isFinite(t.high) && (t.high < t.entry || t.high < t.currentPrice)) {
            issues.push(`${label}: high is below entry/current price`);
        }
        for (const key of ['entryDate', 'lastDate', 'highDate']) {
            if (!isIsoDate(t[key])) {
                issues.push(`${label}: invalid ${key}`);
            }
        }
        if (t.lastDate < t.entryDate || t.highDate < t.entryDate || t.highDate > t.lastDate) {
            issues.push(`${label}: dates are out of order`);
        }
        if (t.status === 'OPEN') {
            if (t.exitDate || t.exitPrice) issues.push(`${label}: OPEN trade has an exit`);
        } else if (!Number.isFinite(t.exitPrice) || t.exitPrice <= 0 ||
                   !isIsoDate(t.exitDate) ||
                   t.exitDate < t.entryDate || t.exitDate !== t.lastDate) {
            issues.push(`${label}: closed trade has invalid exit`);
        }
        const mark = t.status === 'OPEN' ? t.currentPrice : t.exitPrice;
        if (Number.isFinite(mark) && t.entry > 0 && Number.isFinite(t.finalGain)) {
            const gain = ((mark - t.entry) / t.entry) * 100;
            // Prices are stored to 3 decimals; gains may use the unrounded stop.
            const roundingTolerance = 0.051 + (0.00051 / t.entry) * 100;
            if (Math.abs(t.finalGain - gain) > roundingTolerance) {
                issues.push(`${label}: finalGain does not match marked/exit price`);
            }
        }
    }
    const open = tracker.trades.filter(t => t && t.status === 'OPEN').length;
    if (tracker.summary.totalTracked !== tracker.trades.length || tracker.summary.openCount !== open ||
        tracker.summary.closedCount !== tracker.trades.length - open) issues.push('Summary counts do not match trades');
    const openPnl = tracker.trades.filter(t => t && t.status === 'OPEN').reduce((sum, t) => sum + (t.finalGain || 0), 0);
    const closedPnl = tracker.trades.filter(t => t && t.status !== 'OPEN').reduce((sum, t) => sum + (t.finalGain || 0), 0);
    for (const [key, expected] of Object.entries({ openPnl, closedPnl, totalPnlNow: openPnl + closedPnl })) {
        if (Object.hasOwn(tracker.summary, key) &&
            (!Number.isFinite(tracker.summary[key]) || Math.abs(tracker.summary[key] - expected) > 0.051)) {
            issues.push(`Summary ${key} does not match trades`);
        }
    }
    return issues;
}

module.exports = { trackerIssues };
