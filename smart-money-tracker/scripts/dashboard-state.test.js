const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const state = require('./lib/dashboard_state');
const window = {};
for (const file of ['fresh_rider_tracker.js', 'hot_theme_tracker.js', 'daily_equity_tracker.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {window});
}
const trades = [
    ...window.FRESH_RIDER_TRACKER.trades.map(t => ({...t, trackerType:'FR'})),
    ...window.ADD_ON_TRACKER.trades.map(t => ({...t, trackerType:'ADD'})),
    ...window.FLOOR_ADDON_TRACKER.trades.map(t => ({...t, trackerType:'FLR'})),
    ...window.HOT_THEME_TRACKER.trades.map(t => ({...t, trackerType:'HT'}))
];
const timeline = window.DAILY_EQUITY_TRACKER.timeline;

test('Every historical entry maps to its own original trade and retains its stored daily delta', () => {
    const originals = new Map(trades.map(t => [state.tradeId(t), t]));
    for (let i = 0; i < timeline.length; i++) {
        const merged = state.mergeSnapshotTrades(trades, timeline[i], timeline[i-1]);
        for (let j = 0; j < merged.length; j++) {
            const original = originals.get(merged[j].id);
            assert.ok(original, merged[j].id);
            assert.equal(merged[j].entry, original.entry, merged[j].id);
            assert.equal(merged[j].pnlDeltaToday, timeline[i].trades[j].pnlDeltaToday, merged[j].id);
            if (merged[j].status === 'OPEN') assert.equal(merged[j].exitDate, undefined);
        }
    }
});

test('Legacy daily delta fallback matches entry identity rather than ticker and strategy', () => {
    const originals = [
        {id:'one',name:'SAME',trackerType:'ADD',entryDate:'2026-10-01',entry:1,status:'OPEN'},
        {id:'two',name:'SAME',trackerType:'ADD',entryDate:'2026-10-02',entry:2,status:'OPEN'}
    ];
    const previous = {trades:originals.map((t,i)=>({...t,id:'ADD:'+t.id,gainOnDay:i ? -20 : 60}))};
    const current = {trades:originals.map((t,i)=>({...t,id:'ADD:'+t.id,statusOnDay:'OPEN',gainOnDay:i ? -21 : 58}))};
    assert.deepEqual(state.mergeSnapshotTrades(originals,current,previous).map(t=>t.pnlDeltaToday),[-2,-1]);
});

test('Future metrics mutations cannot change historical snapshots or fabricate missing metrics', () => {
    const entryFacts = {
        id:'one',name:'EXAMPLE',entryDate:'2026-06-03',entryType:'NEW',entry:1,
        entryFloor:0.99,day1ChangePct:2,sector:'Technology',ipoYear:2025,
        themes:['Tech'],isGoldenCombo:true,trackerType:'FR',trackerTitle:'Fresh Rider',
        badgeColor:'#fff',badgeBg:'#000',badgeBorder:'#333'
    };
    const original = {...entryFacts,status:'OPEN',maxGain:5,days:3,slTrail:1,
        currentFloor:1,high:1.05,currentPrice:1.04,livePrice:1.04,finalGain:4,
        changePctToday:2,pnlDeltaToday:2,futureOnly:'later'};
    const snapshot = {date:'2026-06-04',trades:[{
        id:'FR:one',statusOnDay:'OPEN',priceOnDay:1.02,gainOnDay:2,dayChangePct:1,pnlDeltaToday:1
    }]};
    const later = {...original,maxGain:500,days:90,slTrail:4,currentFloor:5,
        high:6,currentPrice:5.5,livePrice:5.5,finalGain:450,changePctToday:50,
        pnlDeltaToday:50,status:'CLOSED_SL',exitDate:'2026-10-01',exitPrice:5,futureOnly:'changed'};
    const [merged] = state.mergeSnapshotTrades([original],snapshot);
    assert.deepEqual(state.mergeSnapshotTrades([later],snapshot),[merged]);
    assert.deepEqual(Object.fromEntries(Object.keys(entryFacts).map(key=>[key,merged[key]])),
        {...entryFacts,id:'FR:one'});
    for (const field of ['maxGain','days','slTrail','currentFloor','high','currentPrice','futureOnly']) {
        assert.equal(merged[field],undefined,field);
        assert.equal(Object.hasOwn(merged,field),false,field);
    }
    assert.equal(merged.livePrice,1.02);
    assert.equal(merged.finalGain,2);
    assert.equal(merged.changePctToday,1);
    assert.equal(merged.pnlDeltaToday,1);
});

test('Snapshot-owned entry facts and historical metrics remain authoritative', () => {
    const original = {id:'one',name:'EXAMPLE',trackerType:'FR',entryDate:'2026-06-03',
        entryType:'NEW',entry:9,entryFloor:8,status:'OPEN',maxGain:500,days:90,
        slTrail:4,currentFloor:5,high:6,currentPrice:5.5};
    const historical = {id:'FR:one',statusOnDay:'OPEN',entry:1,entryFloor:0.95,
        maxGain:0,days:0,slTrail:0.99,currentFloor:1,high:1.03,currentPrice:1.02,
        priceOnDay:1.02,gainOnDay:2,dayChangePct:1,pnlDeltaToday:0};
    const [merged] = state.mergeSnapshotTrades([original],{date:'2026-06-04',trades:[historical]});
    for (const [field,value] of Object.entries(historical)) assert.equal(merged[field],value,field);
    assert.equal(merged.pnlDeltaToday,0);
});

test('Closed snapshots borrow exit details only when the exit was already observed', () => {
    const original = {id:'one',name:'EXAMPLE',trackerType:'FR',entryDate:'2026-06-03',
        entry:1,status:'CLOSED_SL',exitDate:'2026-06-05',exitPrice:0.8};
    const historical = {id:'FR:one',statusOnDay:'CLOSED',priceOnDay:0.98,gainOnDay:-2};
    for (const exitDate of ['2026-06-05','2026-10-01',undefined]) {
        const [merged] = state.mergeSnapshotTrades([{...original,exitDate}],
            {date:'2026-06-04',trades:[historical]});
        assert.equal(merged.status,'CLOSED');
        assert.equal(merged.exitDate,undefined);
        assert.equal(merged.exitPrice,0.98);
    }
    for (const date of ['2026-06-05','2026-06-06']) {
        const [merged] = state.mergeSnapshotTrades([original],{date,trades:[historical]});
        assert.equal(merged.status,'CLOSED_SL');
        assert.equal(merged.exitDate,'2026-06-05');
        assert.equal(merged.exitPrice,0.98);
    }
    for (const date of ['2026-06-04','2026-06-06']) {
        const [merged] = state.mergeSnapshotTrades([original],
            {date,trades:[{...historical,statusOnDay:'OPEN'}]});
        assert.equal(merged.status,'OPEN');
        assert.equal(merged.exitDate,undefined);
        assert.equal(merged.exitPrice,undefined);
    }
});

test('Legacy original matching respects entry type and never selects an ambiguous price', () => {
    const first = {id:'one',name:'SAME',trackerType:'ADD',entryDate:'2026-10-01',entryType:'NEW',entry:1};
    const second = {...first,id:'two',entryType:'ADD-ON',entry:2};
    const historical = {id:'ADD:legacy',name:' same ',trackerType:'ADD',entryDate:'2026-10-01',
        statusOnDay:'OPEN',priceOnDay:3,gainOnDay:1};
    for (const originals of [[first,second],[second,first]]) {
        for (const [entryType,entry] of [['NEW',1],['ADD-ON',2]]) {
            const [merged] = state.mergeSnapshotTrades(originals,
                {date:'2026-10-02',trades:[{...historical,entryType}]});
            assert.equal(merged.entry,entry);
        }
        const [merged] = state.mergeSnapshotTrades(originals,{date:'2026-10-02',trades:[historical]});
        assert.equal(merged.entry,undefined);
    }
    const duplicates = [first,{...first,id:'other',entry:9},{...first,id:'third',entry:10}];
    for (const originals of [duplicates,duplicates.slice().reverse(),duplicates.map(t=>({...t,id:undefined}))]) {
        const [merged] = state.mergeSnapshotTrades(originals,
            {date:'2026-10-02',trades:[{...historical,id:undefined,name:'SAME',entryType:'NEW'}]});
        assert.equal(merged.entry,undefined);
        assert.equal(merged.livePrice,3);
    }
    const [exact] = state.mergeSnapshotTrades(duplicates,
        {date:'2026-10-02',trades:[{...historical,id:'ADD:one',entryType:'NEW'}]});
    assert.equal(exact.entry,1);
    const [otherTracker] = state.mergeSnapshotTrades([first],
        {date:'2026-10-02',trades:[{...historical,trackerType:'FR',entryType:'NEW'}]});
    assert.equal(otherTracker.entry,undefined);
});

test('Live and filtered totals include floor ADD-ON entries and reconcile with daily history', () => {
    const totals = state.pnlTotals(trades);
    assert.equal(+totals.total.toFixed(1), timeline.at(-1).totalPnl);
    assert.equal(+totals.addon.toFixed(1), timeline.at(-1).addOnPnl);
    const subset = trades.filter(t=>t.name==='CBHB');
    assert.equal(+state.pnlTotals(subset).total.toFixed(1), +subset.reduce((sum,t)=>sum+t.finalGain,0).toFixed(1));
});

test('Appending future entries and later exits cannot change a historical scanner', () => {
    const first = {name:'EXAMPLE',entryDate:'2026-06-03',entry:1,entryFloor:0.99,currentFloor:0.99,status:'OPEN',entryType:'NEW'};
    const later = {...first,currentFloor:5,status:'CLOSED_SL',exitDate:'2026-10-01',maxGain:500};
    const future = {...first,entryDate:'2026-09-03',entry:4,entryType:'ADD-ON'};
    assert.deepEqual([...state.latestTradeMap([later,future],'2026-06-03')], [...state.latestTradeMap([first],'2026-06-03')]);
    assert.equal(state.latestTradeMap([later],'2026-10-01').get('EXAMPLE').status,'CLOSED_SL');
    assert.equal(state.latestTradeMap([later,future],'2026-09-04').get('EXAMPLE').entry,4);
});

test('Recent floors never fall forward to the newest timeline on an absent archive date', () => {
    const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
    const source = html.slice(html.indexOf('        function getRecentFloorMap('),html.indexOf('        // Global Filter Mode for Fresh Rider'));
    const ctx = vm.createContext({DashboardState:state,_recentFloorCache:null,window:{
        SCANNER_HISTORY:{timeline:[{date:'2026-06-03',prices:{A:1}},{date:'2026-10-14',prices:{A:5}}]},
        ALL_TRACKER:{trades:[{name:'FUTURE',entryDate:'2026-09-01',entryFloor:8,currentFloor:9}]}
    }});
    vm.runInContext(source,ctx);
    assert.equal(ctx.getRecentFloorMap('2026-06-04').get('A'),1);
    assert.equal(ctx.getRecentFloorMap('2026-06-04').has('FUTURE'),false);
    assert.equal(ctx.getRecentFloorMap('2026-06-01').size,0);
});
