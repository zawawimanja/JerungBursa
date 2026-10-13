const test = require('node:test');
const assert = require('node:assert/strict');
const { assessStock, evaluateSnapshot, shouldUseDailyQuote, quoteMetadata } = require('./lib/data_quality');
const rules = require('./lib/strategy_rules');
const { simulate, dailyBar, nextSession } = require('./lib/execution_backtest');
const { compactHistory } = require('./generate_scanner_history');
const live = require('../live-refresh');
const now = Date.parse('2026-10-13T09:00:00Z');
const sample = {name:'EXAMPLE',code:'1234',price:1,changePct:0,isVvip:true,ipoYear:2025,pullback:1,closeTightness:2,touchCount:4,turnover:3000000,floorLow:0.99};
const day = (date, price, extra = {}) => ({date,lastUpdated:date+'T09:00:00Z',topVolume:[{name:'EXAMPLE',price,signal:'watch',...extra}]});

test('Quality distinguishes a hard identity contradiction from missing confirmation', () => {
    assert.equal(assessStock(sample,{mappings:{EXAMPLE:'9999.KL'},now}).status,'reject');
    const incomplete = assessStock(sample,{now});
    assert.equal(incomplete.status,'warning'); assert.equal(incomplete.verified,false);
    const confirmed = assessStock({...sample,provenance:{priceSource:'fixture',observedAt:'2026-10-13T09:00:00Z',quoteAt:'2026-10-13T08:59:00Z'}},{mappings:{EXAMPLE:'1234.KL'},now});
    assert.equal(confirmed.status,'verified');
});
test('Impossible prices/times are rejected; unexplained jumps stay visible as warnings', () => {
    assert.equal(assessStock({...sample,price:NaN},{now}).status,'reject');
    assert.equal(assessStock({...sample,quoteAt:'2026-10-14T09:00:00Z'},{now}).status,'reject');
    assert.ok(assessStock({...sample,price:2},{previous:sample,now}).issues.some(i=>i.code==='PRICE_JUMP'));
    assert.equal(evaluateSnapshot({lastUpdated:'invalid',topVolume:[sample]},{now}).status,'reject');
});
test('Shared strategy explanations and the 5% ranking limit agree at boundaries', () => {
    const eligible = rules.evaluateTopRanking({...sample,price:1.05},{freshness:2,floor:1});
    assert.equal(eligible.eligible,true);
    const rejected = rules.evaluateTopRanking({...sample,price:1.051},{freshness:2,floor:1});
    assert.equal(rejected.eligible,false); assert.ok(rejected.reasons.some(r=>r.code==='FLOOR_DISTANCE'));
    assert.equal(rules.evaluateFreshRider({...sample,hasVolumeSpike:true,changePct:-2},{stage:'candidate'}).eligible,false);
    assert.equal(rules.evaluateGoldenCombo({...sample,changePct:-2},{floor:0.99}).eligible,false);
});
test('Scanner history preserves per-day minima without full trade payloads', () => {
    const compact = compactHistory({generatedAt:'fixed',timeline:[{date:'2026-10-13',trades:[{name:'EXAMPLE',priceOnDay:1},{name:'EXAMPLE',priceOnDay:0.9}]}]});
    assert.deepEqual(compact.timeline[0],{date:'2026-10-13',prices:{EXAMPLE:0.9}});
});
test('Core bundles can omit large daily/execution files without changing the decoder', async () => {
    const calls=[];
    await live.loadBundle('',async url=>{calls.push(url);return {ok:true,text:async()=> 'window.SCANNER_HISTORY = {"timeline":[]};'};},now,['scanner_history.js']);
    assert.equal(calls.length,1);assert.ok(!calls[0].includes('daily_equity'));
    await assert.rejects(live.loadBundle('',undefined,now,['unknown.js']),/Unknown data file/);
});
test('T+1 entry respects trading holidays and never uses IPO openPrice as daily OHLC', () => {
    assert.equal(nextSession('2026-09-15'),'2026-09-17');
    assert.equal(dailyBar({openPrice:0.3,price:1}),null);
    const result=simulate([day('2026-10-12',1,{signal:'buy'}),day('2026-10-13',1.1)]);
    assert.equal(result.trades[0].status,'UNCONFIRMED');
});
test('Backtest fees reduce PnL and entry execution cannot exceed the limit', () => {
    const result=simulate([day('2026-10-09',1,{signal:'buy'}),day('2026-10-12',0.99),day('2026-10-13',1.02)],[],{holdingDays:2});
    const trade=result.trades[0];
    assert.equal(trade.status,'CLOSED');assert.ok(trade.entryPrice<=1);
    assert.ok(trade.netPnl<trade.grossPnl);assert.equal(trade.newsCoverage,'unknown');
    const strict=simulate([day('2026-10-09',1,{signal:'buy'}),day('2026-10-12',0.99)],[],{requireKnownNews:true});
    assert.equal(strict.trades[0].status,'SKIPPED_RISK');
});
test('Appending future prices/news cannot rewrite an already completed execution', () => {
    const prefix=[day('2026-10-09',1,{signal:'buy'}),day('2026-10-12',0.99),day('2026-10-13',1.02)];
    const short=simulate(prefix,[],{holdingDays:2}).trades[0];
    const long=simulate([...prefix,day('2026-10-14',2)],[{recordedAt:'2026-10-14T09:00:00Z',records:{}}],{holdingDays:2}).trades[0];
    assert.deepEqual(long,short);
});
test('Missing T+1 price remains missing instead of being filled on a later session', () => {
    const result=simulate([day('2026-10-09',1,{signal:'buy'}),day('2026-10-13',0.8)]);
    assert.equal(result.trades[0].status,'NO_ENTRY_DATA');assert.equal(result.summary.filledCount,0);
});
test('Explicit OHLC gap stop uses the opening price, with adverse execution costs', () => {
    const result=simulate([day('2026-10-09',1,{signal:'buy'}),day('2026-10-12',1,{dailyOHLC:{open:1,high:1.01,low:0.98,close:1}}),day('2026-10-13',0.8,{dailyOHLC:{open:0.8,high:0.85,low:0.79,close:0.8}})]);
    assert.equal(result.trades[0].exitReason,'STOP');assert.ok(result.trades[0].exitPrice<0.8);
});

test('Overnight settlement data is allowed before T+1 decisions; later backfills are excluded', () => {
    const recorded = {...day('2026-10-12',1,{signal:'buy'}),lastUpdated:'2026-10-12T17:00:00Z'};
    assert.notEqual(simulate([recorded,day('2026-10-13',0.99)]).trades[0].status,'INVALID_DATA');
    recorded.lastUpdated = '2026-10-13T02:00:00Z';
    assert.equal(simulate([recorded,day('2026-10-13',0.99)]).trades[0].status,'INVALID_DATA');
});

test('Old daily bars cannot overwrite a valid current-session market quote', () => {
    assert.equal(shouldUseDailyQuote('2026-10-09T01:00:00Z','2026-10-12T02:00:00Z',1),false);
    assert.equal(shouldUseDailyQuote('2026-10-12T01:00:00Z','2026-10-12T02:00:00Z',1),true);
    assert.equal(shouldUseDailyQuote('2026-10-12T03:00:00Z','2026-10-12T02:00:00Z',0),false);
    assert.equal(dailyBar({barAt:'2026-10-09T01:00:00Z',dailyOHLC:{open:1,high:1.1,low:0.9,close:1}},'2026-10-12'),null);
});

test('Emitted quote metadata retains provider identity so the snapshot guard can reject a contradiction', () => {
    const emitted = {...sample,...quoteMetadata({...sample,providerCode:'9999',quoteAt:'2026-10-13T08:59:00Z',priceSource:'fixture'})};
    const result = evaluateSnapshot({lastUpdated:'2026-10-13T09:00:00Z',topVolume:[emitted]},{mappings:{EXAMPLE:'1234.KL'},now});
    assert.equal(emitted.code,'1234');assert.equal(result.rejectedCount,1);
    assert.ok(result.stocks.EXAMPLE.issues.some(issue=>issue.code==='PROVIDER_CODE_MISMATCH'));
});
test('Intraday archives cannot masquerade as closing-price signals', () => {
    const signal = {...day('2026-10-12',1,{signal:'buy'}),lastUpdated:'2026-10-12T08:46:13Z'};
    assert.equal(simulate([signal,day('2026-10-13',0.99)]).trades[0].status,'INVALID_DATA');
});
test('Live news observations record completion time, including confirmed empty feeds', async () => {
    const fs = require('fs'), path = require('path'), os = require('os');
    const {generateNewsData} = require('./generate_news_data');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(),'jerung-news-observation-'));
    try {
        fs.writeFileSync(path.join(directory,'live_data.json'),JSON.stringify({lastUpdated:'2026-10-13T09:00:00Z',topVolume:[sample]}));
        await generateNewsData({dataDir:directory,reference:'2026-10-13T09:00:00Z',clock:()=>new Date('2026-10-13T09:01:00Z'),logger:{log(){},warn(){}},fetchRisk:async()=>({announcements:[],entitlements:[],fetchStatus:{announcements:'ok',entitlements:'ok'}})});
        const archive = JSON.parse(fs.readFileSync(path.join(directory,'history',fs.readdirSync(path.join(directory,'history'))[0]),'utf8'));
        assert.equal(archive.recordedAt,'2026-10-13T09:01:00.000Z');
        assert.equal(archive.records.EXAMPLE.lastSuccessfulAt.announcements,archive.recordedAt);
        const result=simulate([day('2026-10-13',1,{signal:'buy'}),day('2026-10-14',0.99)],[archive]);
        assert.equal(result.coverage.newsKnownSignals,0);
    } finally {
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep) && path.basename(directory).startsWith('jerung-news-observation-'));
        fs.rmSync(directory,{recursive:true,force:true});
    }
});
