const fs = require('fs');
const path = require('path');
const { simulate } = require('./lib/execution_backtest');
function generate(dataDir = path.resolve(__dirname, '..'), options = {}) {
    const historyDir = path.join(dataDir, 'history');
    const files = fs.readdirSync(historyDir).sort();
    const snapshots = files.filter(file => /^data_\d{4}-\d{2}-\d{2}\.json$/.test(file)).map(file =>
        ({ ...JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8')), date: file.slice(5, 15) }));
    const archives = files.filter(file => /^news_.*\.json$/.test(file)).map(file => JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8')));
    const result = { ...simulate(snapshots, archives, options), generatedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dataDir, 'execution_backtest.js'), `window.EXECUTION_BACKTEST = ${JSON.stringify(result)};\n`);
    return result;
}
if (require.main === module) console.log(JSON.stringify(generate().summary));
module.exports = { generate };
