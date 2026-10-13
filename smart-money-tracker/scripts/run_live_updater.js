const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getMytDate, isTradingDay } = require('./lib/bursa_calendar');
const { runMarketPipeline } = require('./lib/market_pipeline');

const INTERVAL = 5 * 60 * 1000;
const APP_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(APP_DIR, '..');
const DATA_PATHS = ['live_data.json', 'live_data.js', 'fresh_rider_tracker.js', 'hot_theme_tracker.js',
    'daily_equity_tracker.js', 'scanner_history.js', 'execution_backtest.js', 'jerung-data.json', 'jerung-data.js', 'news_data.js',
    'symbol_mappings.json', 'history/'].map(file => `smart-money-tracker/${file}`);

function run(command, args, cwd = APP_DIR, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { ...options, cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (stdout.trim()) console.log(stdout.trim());
            if (stderr.trim()) console.error(stderr.trim());
            if (error) reject(error);
            else resolve(stdout.trim());
        });
    });
}

function getMytTime(now) {
    const shifted = new Date(now.getTime() + 8 * 3600000);
    return { hour: shifted.getUTCHours(), min: shifted.getUTCMinutes(), dateStr: getMytDate(now) };
}

async function publishData(runCommand = run, logger = console) {
    await runCommand('git', ['add', '--', ...DATA_PATHS], PROJECT_ROOT);
    const staged = await runCommand('git', ['diff', '--cached', '--name-only', '--', ...DATA_PATHS], PROJECT_ROOT);
    if (!staged) return;
    await runCommand('git', ['commit', '--only', '-m', 'Auto-update live market data (5-min bot)', '--', ...DATA_PATHS], PROJECT_ROOT);
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await runCommand('git', ['push', 'origin', 'main'], PROJECT_ROOT);
            logger.log('✅ Data published to GitHub.');
            return;
        } catch (error) {
            if (attempt === 3) throw error;
            await runCommand('git', ['pull', '--rebase', 'origin', 'main'], PROJECT_ROOT);
        }
    }
}

function createLiveUpdater({ runCommand = run, now = () => new Date(),
    publish = () => publishData(runCommand), logger = console } = {}) {
    let isRunning = false;
    let lastAlertSentDate = null;
    async function runScraper() {
        if (isRunning) return;
        const { hour, min, dateStr } = getMytTime(now());
        const minutes = hour * 60 + min;
        if (!isTradingDay(dateStr) || minutes < 8 * 60 + 30 || minutes >= 18 * 60 + 15) return;
        isRunning = true;
        let generating = false;
        try {
            // Synchronize before generating files; do not rebase over existing tracked changes.
            const dirty = await runCommand('git', ['status', '--porcelain', '--untracked-files=no'], PROJECT_ROOT);
            if (dirty) throw new Error('Tracked changes exist; save them before running the updater.');
            const branch = await runCommand('git', ['branch', '--show-current'], PROJECT_ROOT);
            if (branch !== 'main') throw new Error('The live updater must run on main.');
            await runCommand('git', ['pull', '--ff-only', 'origin', 'main'], PROJECT_ROOT);
            generating = true;
            await runMarketPipeline(runCommand);
            const testFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.test.js'))
                .sort().map(file => path.join(__dirname, file));
            await runCommand(process.execPath, ['--test', ...testFiles]);
            await runCommand(process.execPath, [path.join(__dirname, 'verify_scanner_tracker_sync.js')]);
            generating = false;
            await publish();

            // Alerts follow publication and cannot race with generation or git push.
            if (hour === 17 && min >= 15 && min <= 35 && lastAlertSentDate !== dateStr) {
                await runCommand(process.execPath, [path.join(__dirname, 'buy_alert.js')], APP_DIR,
                    { env: { ...process.env, BUY_ALERT_REQUIRE_DELIVERY: 'true' } });
                lastAlertSentDate = dateStr;
            }
            await runCommand(process.execPath, [path.join(__dirname, 'portfolio_alert.js')]);
        } catch (error) {
            logger.error(`❌ Live update failed: ${error.message}`);
            // The tree was clean before generation. Discard only this unpublished
            // attempt's tracked data so a transient failure cannot block every retry.
            if (generating) {
                try {
                    await runCommand('git', ['restore', '--worktree', '--', ...DATA_PATHS], PROJECT_ROOT);
                } catch (restoreError) {
                    logger.error(`Generated data recovery failed: ${restoreError.message}`);
                }
            }
        } finally {
            isRunning = false;
        }
    }
    return runScraper;
}

const runScraper = createLiveUpdater();

if (require.main === module) {
    void runScraper();
    setInterval(runScraper, INTERVAL);
    console.log('Live updater: prices, news and trackers every 5 min, 08:30–18:15 MYT.');
}

module.exports = { getMytTime, runScraper, createLiveUpdater, publishData, DATA_PATHS };
