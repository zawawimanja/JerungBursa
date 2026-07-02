const fs = require('fs');
const path = require('path');

const file30 = path.join(__dirname, '../history/data_2026-06-30.json');
const file01 = path.join(__dirname, '../history/data_2026-07-01.json');

const data30 = JSON.parse(fs.readFileSync(file30, 'utf8'));
const data01 = JSON.parse(fs.readFileSync(file01, 'utf8'));

const stocks30 = data30.topVolume || [];
const stocks01 = data01.topVolume || [];

const targets = ['CHB', 'SUM', 'MMCS'];

console.log('=== DATA PADA 30 JUN ===');
targets.forEach(t => {
    const stock = stocks30.find(s => s.name === t);
    if (stock) {
        console.log(`\nStock: ${t}`);
        console.log(JSON.stringify(stock, null, 2));
    } else {
        console.log(`\nStock: ${t} (Not found on 30 Jun)`);
    }
});

console.log('\n=== DATA PADA 1 JULAI ===');
targets.forEach(t => {
    const stock = stocks01.find(s => s.name === t);
    if (stock) {
        console.log(`\nStock: ${t}`);
        console.log(JSON.stringify(stock, null, 2));
    } else {
        console.log(`\nStock: ${t} (Not found on 1 Jul)`);
    }
});
