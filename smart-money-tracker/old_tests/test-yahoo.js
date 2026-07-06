(async () => {
    const yahooFinance = (await import('yahoo-finance2')).default;
    try {
        // Query trending symbols for MY? Or just use screener for Malaysia
        const result = await yahooFinance.screener({ predefinedScreener: 'most_actives', region: 'MY' });
        console.log("Yahoo Finance most_actives count:", result.quotes.length);
        console.log(result.quotes.slice(0, 5));
    } catch(e) {
        console.log("Error:", e.message);
    }
})();
