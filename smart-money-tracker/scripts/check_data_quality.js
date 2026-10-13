const fs = require('fs');
const path = require('path');
const {evaluateSnapshot} = require('./lib/data_quality');
const {parseDataScript} = require('../live-refresh');
function inspect(dataDir=path.resolve(__dirname,'..')) {
    const raw=JSON.parse(fs.readFileSync(path.join(dataDir,'live_data.json'),'utf8'));
    const mappings=JSON.parse(fs.readFileSync(path.join(dataDir,'symbol_mappings.json'),'utf8'));
    const quality=evaluateSnapshot(raw,{mappings});
    const news=parseDataScript(fs.readFileSync(path.join(dataDir,'news_data.js'),'utf8'),['NEWS_DATA']).NEWS_DATA;
    const failedNewsFeeds=Object.values(news).filter(record=>Object.values(record.fetchStatus||{}).includes('error')).length;
    return {...quality,failedNewsFeeds,lastUpdated:raw.lastUpdated};
}
if(require.main===module) {
    const quality=inspect();
    console.log(JSON.stringify({status:quality.status,snapshot:quality.lastUpdated,quotes:quality.stockCount,confirmed:quality.verifiedCount,needConfirmation:quality.warningCount,rejected:quality.rejectedCount,failedNewsFeeds:quality.failedNewsFeeds},null,2));
    console.log('A warning indicates missing confirmation, not a fabricated current quote time.');
    process.exitCode=quality.status==='reject'||(process.argv.includes('--strict')&&quality.warningCount>0)?1:0;
}
module.exports={inspect};
