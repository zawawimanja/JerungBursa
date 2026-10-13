// Audit structural invariants, not a fixed list of stocks that must stay OPEN.
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
        for (const key of ['entryDate', 'lastDate', 'highDate']) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(t[key] || '') || !Number.isFinite(Date.parse(t[key]))) {
                issues.push(`${label}: invalid ${key}`);
            }
        }
        if (t.lastDate < t.entryDate || t.highDate < t.entryDate || t.highDate > t.lastDate) {
            issues.push(`${label}: dates are out of order`);
        }
        if (t.status === 'OPEN') {
            if (t.exitDate || t.exitPrice) issues.push(`${label}: OPEN trade has an exit`);
        } else if (!Number.isFinite(t.exitPrice) || t.exitPrice <= 0 ||
                   !/^\d{4}-\d{2}-\d{2}$/.test(t.exitDate || '') ||
                   t.exitDate < t.entryDate || t.exitDate !== t.lastDate) {
            issues.push(`${label}: closed trade has invalid exit`);
        }
    }
    const open = tracker.trades.filter(t => t && t.status === 'OPEN').length;
    if (tracker.summary.totalTracked !== tracker.trades.length || tracker.summary.openCount !== open ||
        tracker.summary.closedCount !== tracker.trades.length - open) issues.push('Summary counts do not match trades');
    return issues;
}

module.exports = { trackerIssues };
