const fs = require('fs');
const path = require('path');
const { parseDataScript } = require('../live-refresh');

function compactHistory(equity) {
    return { generatedAt: equity.generatedAt, timeline: equity.timeline.map(snapshot => {
        const prices = {};
        for (const trade of snapshot.trades || []) {
            const price = trade.priceOnDay || trade.currentPrice || trade.entry;
            if (trade.name && price > 0) {
                const name = trade.name.toUpperCase();
                prices[name] = Math.min(prices[name] ?? Infinity, price);
            }
        }
        return { date: snapshot.date, prices };
    }) };
}
function generateScannerHistory(dataDir = path.resolve(__dirname, '..')) {
    const equity = parseDataScript(fs.readFileSync(path.join(dataDir, 'daily_equity_tracker.js'), 'utf8'), ['DAILY_EQUITY_TRACKER']).DAILY_EQUITY_TRACKER;
    const compact = compactHistory(equity);
    fs.writeFileSync(path.join(dataDir, 'scanner_history.js'), `window.SCANNER_HISTORY = ${JSON.stringify(compact)};\n`);
    return compact;
}
if (require.main === module) generateScannerHistory();
module.exports = { compactHistory, generateScannerHistory };
