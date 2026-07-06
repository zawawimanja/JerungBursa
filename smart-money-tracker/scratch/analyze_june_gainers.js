const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '../history');

function main() {
    const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith('data_2026-06-') && f.endsWith('.json'))
        .sort();

    if (files.length === 0) {
        console.error("No June history files found.");
        return;
    }

    const firstPrices = {};
    const lastPrices = {};
    const ipoGrades = {};

    files.forEach(file => {
        const filePath = path.join(HISTORY_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const list = data.topVolume || [];

        list.forEach(item => {
            const name = item.name.toUpperCase().trim();
            if (item.price && item.price > 0) {
                if (firstPrices[name] === undefined) {
                    firstPrices[name] = item.price;
                }
                lastPrices[name] = item.price;
                if (item.ipoGrade) {
                    ipoGrades[name] = item.ipoGrade;
                }
            }
        });
    });

    const gainers = [];
    Object.keys(firstPrices).forEach(name => {
        const start = firstPrices[name];
        const end = lastPrices[name];
        const gain = ((end - start) / start) * 100;
        gainers.push({
            name,
            start,
            end,
            gain,
            grade: ipoGrades[name] || 'Non-IPO'
        });
    });

    // Filter only those with gain > 0 and sort by gain descending
    gainers.sort((a, b) => b.gain - a.gain);

    console.log("=== TOP 15 GAINERS IN HISTORY FOR JUNE 2026 ===");
    console.log("=".repeat(80));
    console.log("Rank | Ticker     | Start Price | End Price  | Gain (%)  | IPO Grade");
    console.log("-".repeat(80));
    gainers.slice(0, 15).forEach((item, idx) => {
        console.log(
            `${String(idx + 1).padEnd(4)} | ` +
            `${item.name.padEnd(10)} | ` +
            `RM ${item.start.toFixed(3).padEnd(9)} | ` +
            `RM ${item.end.toFixed(3).padEnd(9)} | ` +
            `${item.gain >= 0 ? '+' : ''}${item.gain.toFixed(2).padStart(8)}% | ` +
            `${item.grade}`
        );
    });
}

main();
