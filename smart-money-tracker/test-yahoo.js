(async () => {
    const payload = {
        offset: 0,
        size: 100,
        sortField: "percentchange",
        sortType: "DESC",
        quoteType: "EQUITY",
        query: {
            operator: "AND",
            operands: [
                { operator: "EQ", operands: ["region", "my"] },
                { operator: "GT", operands: ["regularmarketvolume", 100000] }
            ]
        }
    };
    const res = await fetch("https://query1.finance.yahoo.com/v1/finance/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(data.finance && data.finance.result && data.finance.result[0].quotes) {
        console.log(data.finance.result[0].quotes.slice(0, 5).map(q => q.symbol));
    } else {
        console.log("No data", data);
    }
})();
