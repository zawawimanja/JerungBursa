const fs = require('fs');
const pathIpoData = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\ipo\\data.json";

if (!fs.existsSync(pathIpoData)) {
    console.log('ipo/data.json not found');
    process.exit(1);
}

const ipos = JSON.parse(fs.readFileSync(pathIpoData, 'utf8'));

console.log('=== SEARCHING FOR CURRENTLY TRADING IPOs WITH STRONG FUNDAMENTALS ===');

const results = [];
ipos.forEach(ipo => {
    if (ipo.price > 1.00 || !ipo.price) return;
    if (ipo.status !== 'Listed') return; // only listed ones
    
    const insight = (ipo.analystInsight || '').toLowerCase();
    
    const keywords = ['net cash', 'debt free', 'customer', 'margin', 'untung', 'profitability', 'pat', 'fundamental', 'fortress balance sheet', 'cagr', 'roe'];
    let matches = [];
    keywords.forEach(kw => {
        if (insight.includes(kw)) {
            matches.push(kw);
        }
    });

    if (matches.length >= 2 || ipo.predictedGrade === 'A' || ipo.market === 'Main Market') {
        results.push({
            id: ipo.id,
            name: ipo.companyName,
            price: ipo.price,
            market: ipo.market,
            grade: ipo.predictedGrade,
            sector: ipo.sector,
            insight: ipo.analystInsight || '',
            matches: matches
        });
    }
});

results.forEach(res => {
    if (res.grade === 'C') return;
    console.log(`\n- ${res.name} (${res.id}) | Sector: ${res.sector}`);
    console.log(`  IPO Price: RM ${res.price} | Market: ${res.market} | Grade: ${res.grade}`);
    console.log(`  Matches: ${res.matches.join(', ')}`);
    console.log(`  Insight: ${res.insight.replace(/<[^>]*>/g, '').substring(0, 300)}...`);
});
