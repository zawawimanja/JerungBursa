const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HISTORY_DIR = path.join(__dirname, '../history');
const MAPPINGS_FILE = path.join(__dirname, '../symbol_mappings.json');

// Load symbol mappings
let symbolMappings = {};
try {
    symbolMappings = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8'));
} catch (e) {
    console.error("Failed to load symbol mappings:", e.message);
}

// Memory cache for Yahoo Finance charts
const chartCache = {};
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

async function getChart(symbol) {
    if (chartCache[symbol]) return chartCache[symbol];
    try {
        console.log(`📡 Fetching history for ${symbol}...`);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
        const res = await axios.get(url, { headers: HEADERS });
        if (res.data && res.data.chart && res.data.chart.result && res.data.chart.result[0]) {
            const result = res.data.chart.result[0];
            const timestamp = result.timestamp || [];
            const quote = result.indicators.quote[0];
            const close = quote.close || [];
            const low = quote.low || [];
            const high = quote.high || [];
            const open = quote.open || [];
            const volume = quote.volume || [];

            const validDays = [];
            for (let i = 0; i < timestamp.length; i++) {
                if (close[i] !== null && close[i] !== undefined && 
                    low[i] !== null && low[i] !== undefined && 
                    high[i] !== null && high[i] !== undefined &&
                    open[i] !== null && open[i] !== undefined) {
                    // Convert timestamp to YYYY-MM-DD in KL timezone (GMT+8)
                    const date = new Date((timestamp[i] + 8 * 3600) * 1000);
                    const yyyy = date.getUTCFullYear();
                    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const dd = String(date.getUTCDate()).padStart(2, '0');
                    const dateStr = `${yyyy}-${mm}-${dd}`;

                    validDays.push({
                        dateStr,
                        open: open[i],
                        close: close[i],
                        low: low[i],
                        high: high[i],
                        volume: volume[i] || 0
                    });
                }
            }
            chartCache[symbol] = validDays;
            return validDays;
        }
    } catch (e) {
        console.error(`❌ Failed to fetch chart for ${symbol}:`, e.message);
    }
    return null;
}

async function backfill() {
    const files = fs.readdirSync(HISTORY_DIR).filter(f => f.startsWith('data_') && f.endsWith('.json'));
    console.log(`Found ${files.length} historical files to backfill.`);

    for (const file of files) {
        const filePath = path.join(HISTORY_DIR, file);
        // Extract date from filename (e.g. data_2026-06-15.json -> 2026-06-15)
        const dateMatch = file.match(/data_(\d{4}-\d{2}-\d{2})\.json/);
        if (!dateMatch) continue;
        const fileDateStr = dateMatch[1];
        console.log(`\n⏳ Processing ${file} (Date: ${fileDateStr})...`);

        let content;
        try {
            content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error(`Failed to read ${file}:`, e.message);
            continue;
        }

        const topVolume = content.topVolume || [];
        if (!Array.isArray(topVolume) || topVolume.length === 0) {
            console.log(`No records found in ${file}.`);
            continue;
        }

        let updatedCount = 0;
        for (const item of topVolume) {
            // Find Yahoo Finance ticker symbol
            let symbol = symbolMappings[item.name];
            if (!symbol) {
                // Try finding ticker in keys by checking prefix
                const foundKey = Object.keys(symbolMappings).find(k => k.toUpperCase() === item.name.toUpperCase());
                if (foundKey) symbol = symbolMappings[foundKey];
            }
            if (!symbol) {
                // If still not found, try to guess or skip
                continue;
            }

            const validDays = await getChart(symbol);
            if (!validDays || validDays.length === 0) continue;

            // Find the index matching this archive date
            let targetIdx = validDays.findIndex(d => d.dateStr === fileDateStr);
            if (targetIdx === -1) {
                // If not exact match, find closest date before or equal to the file date
                const targetTime = new Date(fileDateStr).getTime();
                let closestIdx = -1;
                let minDiff = Infinity;
                validDays.forEach((d, idx) => {
                    const t = new Date(d.dateStr).getTime();
                    if (t <= targetTime) {
                        const diff = targetTime - t;
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestIdx = idx;
                        }
                    }
                });
                targetIdx = closestIdx;
            }

            if (targetIdx === -1) {
                continue;
            }

            const targetDay = validDays[targetIdx];

            // 1. Kaunter Sikat (Comb Stock) calculation
            const last20 = validDays.slice(Math.max(0, targetIdx - 19), targetIdx + 1);
            let sumTurnover20 = 0;
            let flatDays20 = 0;
            let activeDays20 = 0;

            last20.forEach(d => {
                if (d.volume > 0) {
                    activeDays20++;
                    sumTurnover20 += d.close * d.volume;
                    if (d.high === d.low) {
                        flatDays20++;
                    }
                }
            });

            const avgTurnover20 = activeDays20 > 0 ? (sumTurnover20 / activeDays20) : 0;
            const flatPct20 = activeDays20 > 0 ? ((flatDays20 / activeDays20) * 100) : 0;
            const isCombStock = (avgTurnover20 < 500000) || (flatPct20 >= 15.0);

            // 2. Wick Rejection calculation
            // Lookback for floor
            const lookback10 = Math.min(10, targetIdx + 1);
            const dailyLookback10 = validDays.slice(targetIdx + 1 - lookback10, targetIdx + 1);
            const lows10 = dailyLookback10.map(d => d.low);
            const minLow = Math.min(...lows10);
            const floorDist = ((targetDay.close - minLow) / minLow) * 100;

            const dailyBody = Math.abs(targetDay.close - targetDay.open);
            const dailyLowerShadow = Math.min(targetDay.open, targetDay.close) - targetDay.low;
            const dailyTotalRange = targetDay.high - targetDay.low;
            
            const isDojiConsolidation = (dailyBody / targetDay.close <= 0.015) && (floorDist <= 1.5);
            
            const hasLowerWickRejection = (dailyTotalRange > 0 && (
                (dailyLowerShadow / dailyTotalRange >= 0.20) || 
                (dailyBody > 0 && dailyLowerShadow / dailyBody >= 0.40) ||
                (dailyBody === 0 && dailyLowerShadow > 0)
            )) || isDojiConsolidation;

            // Update item properties
            item.isCombStock = isCombStock;
            item.hasLowerWickRejection = hasLowerWickRejection;
            
            if (isCombStock && item.signal === 'buy') {
                item.signal = 'avoid';
                item.reason = `⚠️ Illiquid / Comb Stock: Unsuitable Chart Pattern (Avoid Trading!)`;
            }

            updatedCount++;
        }

        // Save file
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
        console.log(`✅ Saved ${file}. Updated ${updatedCount} records.`);
    }

    console.log("\n🎉 All archives have been successfully backfilled!");
}

backfill();
