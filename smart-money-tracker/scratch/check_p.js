const fs = require('fs');
const file = "c:\\Users\\aaror\\OneDrive - PERTUBUHAN KESELAMATAN SOSIAL\\Desktop\\JerungBursa\\smart-money-tracker\\live_data.json";
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = data.topVolume || [];

const portfolio = [
    { name: 'SDCG', buyPrice: 0.725, slPrice: 0.700, allocation: 2000 },
    { name: 'SRKK', buyPrice: 0.545, slPrice: 0.490, allocation: 2000 },
    { name: 'EIPOWER', buyPrice: 0.685, slPrice: 0.630, allocation: 2000 },
    { name: 'RESTNGO', buyPrice: 0.135, slPrice: 0.125, allocation: 2000 }
];

portfolio.forEach(p => {
    const found = list.find(s => {
        const sName = s.name.toUpperCase().trim();
        const pName = p.name.toUpperCase().trim();
        return sName === pName || sName.startsWith(pName) || pName.startsWith(sName);
    });
    if (found) {
        console.log(`${p.name}: Buy: ${p.buyPrice}, Current: ${found.price}, Chg%: ${found.changePct}`);
    } else {
        console.log(`${p.name}: Not found`);
    }
});
