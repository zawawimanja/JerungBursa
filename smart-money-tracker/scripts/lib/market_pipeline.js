const path = require('path');

// Both publishers must evaluate the same snapshot, in the same order.
const MARKET_SCRIPTS = Object.freeze([
    'scrape-real.js',
    'generate_news_data.js',
    'generate_fresh_rider_tracker.js',
    'generate_hot_theme_tracker.js',
    'generate_daily_equity_tracker.js',
    'generate_scanner_history.js',
    'generate_execution_backtest.js',
    'scrape-jerung.js'
]);

async function runMarketPipeline(run, scriptsDir = path.resolve(__dirname, '..')) {
    for (const script of MARKET_SCRIPTS) {
        await run(process.execPath, [path.join(scriptsDir, script)]);
    }
}

module.exports = { MARKET_SCRIPTS, runMarketPipeline };
