const yahooFinance = require('yahoo-finance2').default;

(async () => {
    try {
        const queryOptions = {
            scrIds: 'day_gainers', // top gainers or active
            count: 50,
            region: 'MY'
        };
        const result = await yahooFinance.screener(queryOptions);
        console.log(result.quotes.slice(0, 5).map(q => q.symbol));
    } catch (e) {
        console.log("Error:", e.message);
    }
})();
