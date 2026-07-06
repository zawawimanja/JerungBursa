(async () => {
    try {
        const res = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/5357.KL?range=5d&interval=1d");
        const data = await res.json();
        const timestamps = data.chart.result[0].timestamp;
        const closes = data.chart.result[0].indicators.quote[0].close;
        const volumes = data.chart.result[0].indicators.quote[0].volume;
        for (let i = 0; i < closes.length; i++) {
            if (closes[i] === null) continue;
            const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
            let prev = closes[i];
            let foundPrev = false;
            for(let j = i-1; j>=0; j--){ if(closes[j]!==null){ prev = closes[j]; foundPrev = true; break;} }
            const change = foundPrev ? ((closes[i] - prev) / prev) * 100 : 0;
            console.log(`${date} : RM ${closes[i].toFixed(3)} (${change > 0 ? '+' : ''}${change.toFixed(2)}%) Vol: ${volumes[i]}`);
        }
    } catch (e) { console.error(e); }
})();
