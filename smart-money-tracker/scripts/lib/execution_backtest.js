const { isTradingDay, getMytDate } = require('./bursa_calendar');
const { buildCorporateNewsRisk } = require('./corporate_risk');
const TradeCosts = require('./trade_costs');

const DEFAULTS = Object.freeze({ ...TradeCosts.DEFAULTS, allocation: 2000, lotSize: 100, holdingDays: 10, stopPct: 5,
    slippagePct: 0.1, requireKnownNews: false });
function nextSession(date) {
    const cursor = new Date(date + 'T00:00:00Z');
    do { cursor.setUTCDate(cursor.getUTCDate() + 1); } while (!isTradingDay(cursor.toISOString().slice(0, 10)));
    return cursor.toISOString().slice(0, 10);
}
function fee(notional, config) {
    return TradeCosts.oneSide(notional, config);
}
function dailyBar(stock, date) {
    // openPrice is a historical IPO/base feature in this repository, not a daily open.
    const bar = stock && stock.dailyOHLC;
    if (date && stock?.barAt && getMytDate(stock.barAt) !== date) return null;
    return bar && ['open', 'high', 'low', 'close'].every(key => Number.isFinite(bar[key]) && bar[key] > 0) &&
        bar.low <= Math.min(bar.open, bar.close) && bar.high >= Math.max(bar.open, bar.close) ? bar : null;
}
function simulate(snapshots, newsArchives = [], options = {}) {
    const config = { ...DEFAULTS, ...options };
    for (const key of ['allocation', 'lotSize', 'holdingDays', 'stopPct', 'slippagePct', 'feePct', 'minimumFee', 'clearingPct', 'stampPer1000']) {
        if (!Number.isFinite(config[key]) || config[key] < 0) throw new Error('Invalid backtest assumption: ' + key);
    }
    if (!config.allocation || !Number.isInteger(config.lotSize) || !config.lotSize || !Number.isInteger(config.holdingDays) || !config.holdingDays || config.stopPct >= 100) throw new Error('Invalid execution sizing or stop.');
    const days = snapshots.filter(day => isTradingDay(day.date)).sort((a, b) => a.date.localeCompare(b.date));
    const byDate = new Map(days.map(day => [day.date, day]));
    const rows = day => [...(day?.topVolume || []), ...(day?.topGainers || [])];
    const quote = (date, name) => rows(byDate.get(date)).find(s => s?.name?.toUpperCase() === name && Number.isFinite(s.price) && s.price > 0);
    const trades = [];
    for (const day of days) {
        const seen = new Set();
        for (const stock of rows(day)) {
            if (!stock || stock.signal !== 'buy' || !Number.isFinite(stock.price) || !(stock.price > 0) || !stock.name) continue;
            const name = stock.name.toUpperCase();
            if (seen.has(name)) continue;
            seen.add(name);
            const entryDate = nextSession(day.date);
            const trade = { id: `${name}_${day.date}`, name, signalDate: day.date, signalClose: stock.price,
                entryDate, features: { signal: stock.signal, setupStyle: stock.setupStyle, floorLow: stock.floorLow },
                newsCoverage: 'unknown', status: 'PENDING_ENTRY' };
            const decisionDeadline = Date.parse(entryDate + 'T00:30:00Z');
            if (day.lastUpdated && (!Number.isFinite(Date.parse(day.lastUpdated)) || Date.parse(day.lastUpdated) > decisionDeadline || Date.parse(day.lastUpdated) < Date.parse(day.date+'T09:00:00Z'))) {
                trade.status = 'INVALID_DATA'; trade.dataIssue = 'Signal data is from before market close or after the T+1 pre-opening decision.'; trades.push(trade); continue;
            }
            const signalAt = Date.parse(day.lastUpdated || day.date + 'T09:00:00Z');
            const known = newsArchives.filter(a => Number.isFinite(Date.parse(a.recordedAt)) && Date.parse(a.recordedAt) <= signalAt && signalAt-Date.parse(a.recordedAt)<=24*3600000)
                .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0];
            const record = known?.records?.[name];
            if (record && ['announcements', 'entitlements'].every(key => record.fetchStatus?.[key] === 'ok')) {
                trade.newsCoverage = 'known';
                trade.newsRisk = buildCorporateNewsRisk(record.announcements, record.entitlements, day.date).hasNewsAlert;
            }
            if (trade.newsRisk || (config.requireKnownNews && trade.newsCoverage === 'unknown')) {
                trade.status = 'SKIPPED_RISK'; trades.push(trade); continue;
            }
            const entryQuote = quote(entryDate, name);
            if (!entryQuote) { if (entryDate <= days.at(-1)?.date) trade.status = 'NO_ENTRY_DATA'; trades.push(trade); continue; }
            const entryBar = dailyBar(entryQuote, entryDate);
            if (stock.code && entryQuote.code && stock.code !== entryQuote.code) {
                trade.status = 'INVALID_DATA'; trade.dataIssue = 'Stock identity changed between signal and entry.'; trades.push(trade); continue;
            }
            trade.priceEvidence = entryBar ? 'OHLC' : 'close-only approximation';
            if (entryBar ? entryBar.low > stock.price : entryQuote.price > stock.price) {
                trade.status = entryBar ? 'UNFILLED' : 'UNCONFIRMED'; trades.push(trade); continue;
            }
            const rawEntry = entryBar ? Math.min(entryBar.open, stock.price) : entryQuote.price;
            trade.entryPrice = Math.min(stock.price, rawEntry * (1 + config.slippagePct / 100));
            trade.quantity = Math.floor(config.allocation / trade.entryPrice / config.lotSize) * config.lotSize;
            while (trade.quantity > 0 && trade.quantity * trade.entryPrice + fee(trade.quantity * trade.entryPrice, config) > config.allocation) trade.quantity -= config.lotSize;
            if (!trade.quantity) { trade.status = 'INSUFFICIENT_CAPITAL'; trades.push(trade); continue; }
            const stop = trade.entryPrice * (1 - config.stopPct / 100);
            trade.status = 'OPEN';
            let date = entryDate, lastDate = entryDate, last = entryQuote, held = 0;
            while (date <= days.at(-1).date && held < config.holdingDays) {
                const current = quote(date, name);
                held++;
                if (current) {
                    if ((entryQuote.code && current.code && entryQuote.code !== current.code) || current.price / last.price > 1.5 || current.price / last.price < 0.5) {
                        trade.status = 'INVALID_DATA'; trade.dataIssue = 'Price or identity discontinuity needs corporate-action confirmation.'; break;
                    }
                    last = current;
                    lastDate = date;
                    const bar = dailyBar(current, date);
                    const hitStop = bar ? bar.low <= stop : current.price <= stop;
                    if (hitStop || held === config.holdingDays) {
                        trade.status = 'CLOSED'; trade.exitDate = date;
                        trade.exitReason = hitStop ? 'STOP' : 'TIME';
                        const execution = hitStop && bar ? Math.min(bar.open, stop) : current.price;
                        trade.exitPrice = execution * (1 - config.slippagePct / 100);
                        break;
                    }
                } else trade.missingPriceDays = (trade.missingPriceDays || 0) + 1;
                date = nextSession(date);
            }
            if (trade.status === 'INVALID_DATA') { trades.push(trade); continue; }
            if (trade.status === 'OPEN') { trade.markPrice = last.price; trade.markDate = lastDate; }
            const mark = trade.exitPrice || trade.markPrice;
            const buyNotional = trade.quantity * trade.entryPrice;
            const sellNotional = trade.quantity * mark;
            trade.grossPnl = +(sellNotional - buyNotional).toFixed(2);
            trade.fees = +(fee(buyNotional, config) + fee(sellNotional, config)).toFixed(2);
            trade.netPnl = +(trade.grossPnl - trade.fees).toFixed(2);
            trade.netReturnPct = +(trade.netPnl / buyNotional * 100).toFixed(2);
            trades.push(trade);
        }
    }
    const filled = trades.filter(t => t.quantity > 0 && t.status !== 'INVALID_DATA'), closed = filled.filter(t => t.status === 'CLOSED');
    const sum = key => +filled.reduce((total, t) => total + t[key], 0).toFixed(2);
    return { schemaVersion: 1, summary: { signalCount: trades.length, filledCount: filled.length,
        closedCount: closed.length, openCount: filled.length - closed.length,
        unfilledCount: trades.filter(t => t.status === 'UNFILLED').length,
        unconfirmedFillCount: trades.filter(t => t.status === 'UNCONFIRMED').length,
        skippedRiskCount: trades.filter(t => t.status === 'SKIPPED_RISK').length,
        noEntryDataCount: trades.filter(t => t.status === 'NO_ENTRY_DATA').length,
        rejectedDataCount: trades.filter(t => t.status === 'INVALID_DATA').length,
        grossPnl: sum('grossPnl'), netPnl: sum('netPnl'), totalFees: sum('fees'),
        winRateNetPct: closed.length ? +(closed.filter(t => t.netPnl > 0).length / closed.length * 100).toFixed(1) : null },
        assumptions: { ...config, strategy: 'Archived buy signals; one-session T+1 limit; fixed stop/time exit',
            observationDeadline: 'Signal features must be recorded before 08:30 MYT on T+1; later backfills are excluded.',
            costs: 'Illustrative configurable fees, not a broker quote or statutory fee calculation.',
            priceEvidence: 'Explicit dailyOHLC only; otherwise close-only modeled fills. Intraday fills are unconfirmed.',
            capital: 'Independent allocation per signal; totals are not a capacity-constrained portfolio return.',
            openValuations: 'Open net marks include estimated exit costs; not realized proceeds.' },
        coverage: { snapshotDays: days.length, ohlcTrades: filled.filter(t => t.priceEvidence === 'OHLC').length,
            closeOnlyTrades: filled.filter(t => t.priceEvidence !== 'OHLC').length,
            newsKnownSignals: trades.filter(t => t.newsCoverage === 'known').length,
            newsUnknownSignals: trades.filter(t => t.newsCoverage === 'unknown').length,
            incompleteTradeCount: trades.filter(t => t.missingPriceDays || ['NO_ENTRY_DATA', 'PENDING_ENTRY'].includes(t.status)).length }, trades };
}
module.exports = { DEFAULTS, simulate, nextSession, dailyBar, fee };
