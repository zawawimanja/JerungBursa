const fs = require('fs');
const path = require('path');

const liveDataPath = path.join(__dirname, '../live_data.json');
if (!fs.existsSync(liveDataPath)) {
    console.error("live_data.json not found");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
const topVolume = data.topVolume || [];

console.log("=====================================================================================");
console.log("📊 SCANNER: SAHAM 52W/ATH DENGAN PULLBACK & KENAIKAN HARI INI (PULLBACK BOUNCE)");
console.log("=====================================================================================");
console.log(`Mengimbas ${topVolume.length} kaunter aktif dari pasaran...\n`);

const matched = [];

topVolume.forEach(item => {
    // 1. Mesti mempunyai data 52W High
    if (!item.high52) return;
    
    // 2. Pullback sihat dari puncak 52W High (0.5% hingga 25.0% - bermaksud ada pullback tetapi masih berhampiran puncak)
    const pullback = item.pullback;
    if (pullback === null || pullback === undefined || pullback < 0.5 || pullback > 25.0) return;
    
    // 3. Ada kenaikan hari ini (changePct > 0)
    if (item.change <= 0) return;
    
    // 4. Saringan Price (Bawah 3 sahaja), Liquidity & Kualiti standard
    if (item.price > 3.00) return;
    if (item.turnover < 250000) return;
    if (item.setupName === '🧊 Downtrend / Avoid') return;
    if (item.isCombStock) return;

    const floor = item.floorLow || (item.price * 0.97);
    const dist = parseFloat((((item.price - floor) / floor) * 100).toFixed(2));

    matched.push({
        name: item.name,
        sector: item.sector,
        price: item.price,
        changePct: item.changePct,
        pullback: pullback,
        high52: item.high52,
        floor: floor,
        dist: dist,
        touches: item.touchCount,
        turnover: item.turnover,
        isConsolidation: item.isConsolidation
    });
});

// Susun mengikut pullback terkecil (paling dekat dengan 52W High)
matched.sort((a, b) => a.pullback - b.pullback);

console.log("BIL | KAUNTER    | HARGA    | CHANGE  | PULLBACK | 52W HIGH | DIST FLOOR | TOUCHES | TURNOVER");
console.log("-".repeat(95));

matched.forEach((s, idx) => {
    const trStr = s.turnover >= 1000000 
        ? `${(s.turnover / 1000000).toFixed(2)}M` 
        : `${(s.turnover / 1000).toFixed(0)}K`;

    console.log(
        `${(idx + 1).toString().padEnd(3)} | ` +
        s.name.padEnd(10) + " | " +
        `RM ${s.price.toFixed(3)}`.padEnd(8) + " | " +
        `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`.padEnd(7) + " | " +
        `${s.pullback.toFixed(2)}%`.padEnd(8) + " | " +
        `RM ${s.high52.toFixed(3)}`.padEnd(8) + " | " +
        `+${s.dist.toFixed(2)}%`.padEnd(10) + " | " +
        `${s.touches}x`.padEnd(7) + " | " +
        trStr
    );
});

console.log("-".repeat(95));
console.log(`Jumlah kaunter ditemui: ${matched.length}\n`);
