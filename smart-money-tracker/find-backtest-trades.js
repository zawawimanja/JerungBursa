const fs = require('fs');
const path = require('path');

const backtestFile = 'c:/Users/aaror/OneDrive - PERTUBUHAN KESELAMATAN SOSIAL/Desktop/JerungAI/backtest-data.js';
if (!fs.existsSync(backtestFile)) {
  console.error("backtest-data.js not found at " + backtestFile);
  process.exit(1);
}

const content = fs.readFileSync(backtestFile, 'utf8');
const jsonStr = content.replace('window.BACKTEST_DATA = ', '').replace(/;$/, '');
const data = JSON.parse(jsonStr);

console.log("=== SEJARAH DAGANGAN BACKTEST BAGI PWRWELL & ICENTS ===\n");

const targetStocks = ["PWRWELL", "ICENTS"];

// Search in individual agent trades
Object.values(data.agents).forEach(agent => {
  const matchingTrades = agent.trades.filter(t => targetStocks.includes(t.stock.toUpperCase()));
  if (matchingTrades.length > 0) {
    console.log(`👤 AGENT: ${agent.name} (${agent.tech})`);
    matchingTrades.forEach(t => {
      console.log(`  - Saham: ${t.stock}`);
      console.log(`    Tarikh: ${t.entryDate} -> ${t.exitDate}`);
      console.log(`    Harga: RM ${t.entryPrice.toFixed(3)} -> RM ${t.exitPrice.toFixed(3)}`);
      console.log(`    P&L: ${t.pnl >= 0 ? '+' : ''}${t.pnlPct}% (RM ${t.pnl.toFixed(2)})`);
      console.log(`    Sebab Keluar: ${t.exitReason || 'N/A'}`);
      console.log("    ------------------------");
    });
  }
});
