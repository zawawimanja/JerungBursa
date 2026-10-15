(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DashboardState = api;
})(typeof window === 'object' ? window : globalThis, function () {
    const nameOf = trade => String(trade.name || '').trim().toUpperCase();
    const legacyKey = trade => [trade.trackerType, nameOf(trade), trade.entryDate, trade.entryType].join('|');
    const entryFields = [
        'id', 'name', 'entryDate', 'entryType', 'entry', 'entryFloor', 'day1ChangePct',
        'sector', 'ipoYear', 'themes', 'isGoldenCombo', 'trackerType', 'trackerTitle',
        'badgeColor', 'badgeBg', 'badgeBorder'
    ];
    function tradeId(trade) {
        const id = trade.id || `${nameOf(trade)}_${trade.entryDate}_${trade.entryType || ''}`;
        return id.includes(':') ? id : (trade.trackerType || '') + ':' + id;
    }

    function mergeSnapshotTrades(trades, snapshot, previousSnapshot) {
        const originals = new Map();
        const legacy = new Map();
        for (const trade of trades) {
            const id = tradeId(trade);
            const key = legacyKey(trade);
            originals.set(id, originals.has(id) ? null : trade);
            legacy.set(key, legacy.has(key) ? null : trade);
        }
        const previous = new Map((previousSnapshot?.trades || []).map(trade => [tradeId(trade), trade]));
        return (snapshot.trades || []).map(trade => {
            const original = originals.get(tradeId(trade)) || legacy.get(legacyKey(trade)) || {};
            const entryFacts = {};
            for (const field of entryFields) {
                if (Object.prototype.hasOwnProperty.call(original, field)) entryFacts[field] = original[field];
            }
            const previousTrade = previous.get(tradeId(trade));
            const closed = trade.statusOnDay !== 'OPEN';
            const observedExit = closed && original.exitDate && original.exitDate <= snapshot.date;
            return { ...entryFacts, ...trade,
                livePrice: trade.priceOnDay, finalGain: trade.gainOnDay,
                changePctToday: trade.dayChangePct,
                pnlDeltaToday: Number.isFinite(trade.pnlDeltaToday) ? trade.pnlDeltaToday :
                    (previousTrade ? +((trade.gainOnDay || 0) - (previousTrade.gainOnDay || 0)).toFixed(1) : 0),
                status: closed ? (observedExit && original.status !== 'OPEN' ? original.status || 'CLOSED' : 'CLOSED') : 'OPEN',
                exitDate: observedExit ? original.exitDate : undefined,
                exitPrice: closed ? trade.priceOnDay : undefined
            };
        });
    }

    // Only entry facts and exits already observed on the selected date can affect a scanner.
    function scannerTradesAsOf(trades, date) {
        if (!date) return trades;
        return trades.filter(trade => trade.entryDate && trade.entryDate <= date).map(trade => ({
            name: trade.name, entry: trade.entry, entryDate: trade.entryDate,
            entryFloor: trade.entryFloor, currentFloor: trade.entryFloor,
            entryType: trade.entryType, isGoldenCombo: trade.isGoldenCombo,
            status: trade.exitDate && trade.exitDate <= date ? trade.status : 'OPEN'
        }));
    }

    function latestTradeMap(trades, date) {
        const map = new Map();
        for (const trade of scannerTradesAsOf(trades, date).slice().sort((a, b) =>
            Number(a.status === 'OPEN') - Number(b.status === 'OPEN') || a.entryDate.localeCompare(b.entryDate))) {
            map.set(nameOf(trade), trade);
        }
        return map;
    }

    function pnlTotals(trades) {
        const totals = { fr: 0, addon: 0, ht: 0, total: 0 };
        for (const trade of trades) {
            const value = Number.isFinite(trade.finalGain) ? trade.finalGain : 0;
            if (trade.trackerType === 'FR') totals.fr += value;
            else if (['ADD', 'FLR'].includes(trade.trackerType)) totals.addon += value;
            else if (trade.trackerType === 'HT') totals.ht += value;
            totals.total += value;
        }
        return totals;
    }

    return { tradeId, mergeSnapshotTrades, scannerTradesAsOf, latestTradeMap, pnlTotals };
});
