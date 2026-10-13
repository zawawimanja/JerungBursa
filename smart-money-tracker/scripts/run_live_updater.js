const { execFile } = require('child_process');
const path = require('path');
const { getMytDate, isTradingDay } = require('./lib/bursa_calendar');

const INTERVAL = 5 * 60 * 1000;
const APP_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(APP_DIR, '..');
const DATA_PATHS = ['live_data.json', 'live_data.js', 'fresh_rider_tracker.js', 'hot_theme_tracker.js',
    'daily_equity_tracker.js', 'news_data.js', 'symbol_mappings.json', 'history/'].map(file => `smart-money-tracker/${file}`);
let isRunning = false;
let lastTrackerGeneratedDate = null;
let lastAlertSentDate = null;

function run(command, args, cwd = APP_DIR) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
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

async function publishData() {
    await run('git', ['add', '--', ...DATA_PATHS], PROJECT_ROOT);
    const staged = await run('git', ['diff', '--cached', '--name-only'], PROJECT_ROOT);
    if (!staged) return;
    await run('git', ['commit', '-m', 'Auto-update live market data (5-min bot)'], PROJECT_ROOT);
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await run('git', ['push', 'origin', 'main'], PROJECT_ROOT);
            console.log('✅ Data published to GitHub.');
            return;
        } catch (error) {
            if (attempt === 3) throw error;
            await run('git', ['pull', '--rebase', 'origin', 'main'], PROJECT_ROOT);
        }
    }
}

async function runScraper() {
    if (isRunning) return;
    const { hour, min, dateStr } = getMytTime(new Date());
    const minutes = hour * 60 + min;
    if (!isTradingDay(dateStr) || minutes < 8 * 60 + 30 || minutes >= 18 * 60 + 15) return;
    isRunning = true;
    try {
        // Synchronize before generating files; do not rebase over existing tracked changes.
        const dirty = await run('git', ['status', '--porcelain', '--untracked-files=no'], PROJECT_ROOT);
        if (dirty) throw new Error('Tracked changes exist; save them before running the updater.');
        const branch = await run('git', ['branch', '--show-current'], PROJECT_ROOT);
        if (branch !== 'main') throw new Error('The live updater must run on main.');
        await run('git', ['pull', '--ff-only', 'origin', 'main'], PROJECT_ROOT);
        await run(process.execPath, [path.join(__dirname, 'scrape-real.js')]);

        const postClose = minutes >= 17 * 60 + 50;
        if (postClose && lastTrackerGeneratedDate !== dateStr) {
            for (const script of ['generate_news_data.js', 'generate_fresh_rider_tracker.js', 'generate_hot_theme_tracker.js', 'generate_daily_equity_tracker.js']) {
                await run(process.execPath, [path.join(__dirname, script)]);
            }
        }
        await run(process.execPath, ['--test', path.join(__dirname, 'data-refresh.test.js')]);
        await run(process.execPath, [path.join(__dirname, 'verify_scanner_tracker_sync.js')]);
        await publishData();
        if (postClose) lastTrackerGeneratedDate = dateStr;

        // Alerts follow publication and cannot race with generation or git push.
        if (hour === 17 && min >= 15 && min <= 35 && lastAlertSentDate !== dateStr) {
            await run(process.execPath, [path.join(__dirname, 'buy_alert.js')]);
            lastAlertSentDate = dateStr;
        }
        await run(process.execPath, [path.join(__dirname, 'portfolio_alert.js')]);
    } catch (error) {
        console.error(`❌ Live update failed: ${error.message}`);
    } finally {
        isRunning = false;
    }
}

if (require.main === module) {
    void runScraper();
    setInterval(runScraper, INTERVAL);
    console.log('Live updater: prices every 5 min, 08:30–18:15 MYT; final trackers after 17:50 MYT.');
}

module.exports = { getMytTime, runScraper };
