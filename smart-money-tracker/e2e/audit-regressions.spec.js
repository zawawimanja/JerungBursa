const {test, expect} = require('@playwright/test');
const {loadDashboard} = require('./helpers');

async function archive(page, date) {
    await page.evaluate(date => {
        const input = document.getElementById('historyDate');
        input.value = date;
        input.dispatchEvent(new Event('change'));
    }, date);
}

async function daily(page) {
    await page.locator('#tab-trackerdaily').click();
    await expect(page.locator('#executionModelPanel')).toContainText('T+1 execution study');
}

test('Daily tracker keeps separate entry prices and negative daily PnL for repeated CBHB entries', async ({page}) => {
    const {pageErrors} = await loadDashboard(page);
    await daily(page);
    await page.locator('#tdDateFilter').selectOption('2026-10-14');
    await page.locator('#tdSearchInput').fill('CBHB');
    const rows = page.locator('#tdMoversTableBody tr');
    await expect(rows.filter({hasText:'2026-08-03'})).toContainText('-2.9% pts');
    await expect(rows.filter({hasText:'2026-07-30'})).toContainText('RM 0.675');
    await expect(rows.filter({hasText:'2026-07-30'})).toContainText('-3.0% pts');
    expect(pageErrors).toEqual([]);
});

test('Live, historical and filtered totals include Lantai Rapat without changing amounts', async ({page}) => {
    await loadDashboard(page);
    await daily(page);
    const expected = await page.evaluate(() => {
        const all = [...window.ALL_TRACKER.trades, ...window.HOT_THEME_TRACKER.trades];
        return {all:all.reduce((sum,t)=>sum+t.finalGain,0).toFixed(1),
            cbhb:all.filter(t=>t.name==='CBHB').reduce((sum,t)=>sum+t.finalGain,0).toFixed(1)};
    });
    await expect(page.locator('#tdGrandTotalPnl')).toContainText(expected.all);
    await page.locator('#tdDateFilter').selectOption('2026-10-14');
    await expect(page.locator('#tdGrandTotalPnl')).toContainText(expected.all);
    await page.locator('#tdSearchInput').fill('CBHB');
    await expect(page.locator('#tdGrandTotalPnl')).toContainText(expected.cbhb);
    await page.locator('#tdSearchInput').fill('');
    await page.locator('#tdStrategyFilter').selectOption('addon');
    const expectedCount = await page.evaluate(()=>window.ADD_ON_TRACKER.trades.length+window.FLOOR_ADDON_TRACKER.trades.length);
    await expect(page.locator('#tdMoversTableBody tr')).toHaveCount(expectedCount);
});

test('Archived FR signals are invariant to future tracker entries, floors and exits', async ({page}) => {
    const {pageErrors} = await loadDashboard(page);
    await archive(page,'2026-06-03');
    await page.waitForFunction(()=>getArchiveDate()==='2026-06-03');
    const result = await page.evaluate(() => {
        const before = window._latestFreshRiderPicks.map(t=>t.name);
        for (const trade of window.ALL_TRACKER.trades) {
            trade.currentFloor = 999;
            trade.status = 'CLOSED_SL';
            trade.exitDate = '2026-12-31';
        }
        window.ALL_TRACKER.trades.push({name:'KEEMING',entryDate:'2026-12-01',entry:100,currentFloor:100,status:'OPEN',entryType:'ADD-ON'});
        _recentFloorCache = null;
        renderConfluenceRadar();
        return {before,after:window._latestFreshRiderPicks.map(t=>t.name)};
    });
    expect(result.before).toEqual(expect.arrayContaining(['KEEMING','ISF','ICENTS']));
    expect(result.after).toEqual(result.before);
    expect(pageErrors).toEqual([]);
});

test('The latest requested archive wins even when an earlier response arrives last', async ({page}) => {
    await loadDashboard(page);
    let held;
    let arrived;
    const waiting = new Promise(resolve=>{arrived=resolve;});
    await page.route('**/history/data_2026-10-08.json*', route => {
        if (route.request().url().startsWith('https:')) return route.abort();
        held=route; arrived();
    });
    await archive(page,'2026-10-08');
    await waiting;
    await archive(page,'2026-10-09');
    await page.waitForFunction(()=>getArchiveDate()==='2026-10-09');
    await held.continue();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#historyDate')).toHaveValue('2026-10-09');
    await expect(page.locator('#dashboardSubtitle')).toContainText('2026-10-09');
    expect(await page.evaluate(()=>window._archiveSnapshot.lastUpdated.startsWith('2026-10-09'))).toBe(true);
});

test('A failed archive restores the committed date and keeps risk evaluation on that date', async ({page}) => {
    await loadDashboard(page);
    await archive(page,'2026-10-09');
    await page.waitForFunction(()=>getArchiveDate()==='2026-10-09');
    await archive(page,'2026-10-11');
    await expect(page.locator('#loadHistoryBtn')).toContainText('Not Found');
    await expect(page.locator('#historyDate')).toHaveValue('2026-10-09');
    expect(await page.evaluate(()=>getMarketViewDate())).toBe('2026-10-09');
    await page.locator('#priceMaxFilter').selectOption('0.50');
    await expect(page.locator('#dashboardSubtitle')).toContainText('2026-10-09');
});

test('Returning to Live cancels an archive response still in flight', async ({page}) => {
    await loadDashboard(page);
    let held;
    let arrived;
    const waiting = new Promise(resolve=>{arrived=resolve;});
    await page.route('**/history/data_2026-10-08.json*',route=>{
        if(route.request().url().startsWith('https:'))return route.abort();
        held=route;arrived();
    });
    await archive(page,'2026-10-08');
    await waiting;
    await page.locator('#refreshBtn').click();
    await page.waitForFunction(()=>!_autoRefreshBusy);
    await held.continue();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(()=>({archive:_viewingArchive,date:getArchiveDate()}))).toEqual({archive:false,date:''});
    await expect(page.locator('#historyDate')).toHaveValue('');
});

test('AI output and API error strings render as text rather than executable HTML', async ({page}) => {
    await loadDashboard(page);
    const payload = '<img src="/missing-audit-image" onerror="window.__auditExecuted=true">';
    await page.route('**/api/chat',route=>route.fulfill({json:{text:'### Result\n**Safe formatting**\n'+payload}}));
    await page.evaluate(()=>triggerAIAnalysisModal('PENTECH','Fresh VVIP Rider'));
    await expect(page.locator('#aiModalBody')).toContainText(payload);
    await expect(page.locator('#aiModalBody img')).toHaveCount(0);
    await expect(page.locator('#aiModalBody strong').first()).toHaveText('Safe formatting');
    expect(await page.evaluate(()=>window.__auditExecuted)).toBeUndefined();
    await page.unroute('**/api/chat');
    await page.route('**/api/chat',route=>route.fulfill({status:500,json:{error:payload}}));
    await page.evaluate(()=>triggerAIAnalysisModal('PENTECH','Fresh VVIP Rider'));
    await expect(page.locator('#aiModalBody')).toContainText(payload);
    await expect(page.locator('#aiModalBody img')).toHaveCount(0);
    expect(await page.evaluate(()=>window.__auditExecuted)).toBeUndefined();
});

test('Historical daily rows neither invent stops and holding days nor mislabel floor ADD-ON', async ({page}) => {
    const {pageErrors} = await loadDashboard(page);
    await daily(page);
    await page.locator('#tdDateFilter').selectOption('2026-10-14');
    await page.locator('#tdSearchInput').fill('CBHB');
    const movers = await page.evaluate(() => {
        const row = [...document.querySelectorAll('#tdMoversTableBody tr')]
            .find(r => /CBHB/.test(r.textContent) && /2026-08-03/.test(r.textContent));
        return [...(row?.cells || [])].map(cell => cell.textContent.trim());
    });
    expect(movers.length).toBeGreaterThan(0);
    expect(movers[5]).toBe('RM 1.030');
    expect(movers[9]).toBe('—');
    expect(movers[10]).toBe('—');
    const cohort = await page.evaluate(() => [...document.querySelectorAll('#tdCardsContainer tr')]
        .filter(row => row.cells.length >= 13 && !row.querySelector('th'))
        .map(row => [...row.cells].map(cell => cell.textContent.trim())));
    expect(cohort.length).toBeGreaterThan(0);
    for (const cells of cohort) {
        expect(cells[9]).toBe('—');
        expect(cells[10]).toBe('—');
        expect(cells[12]).toBe('—');
    }
    await page.locator('#tdSearchInput').fill('');
    await page.locator('#tdStrategyFilter').selectOption('addon');
    const body = page.locator('#tdMoversTableBody');
    await expect(body).toContainText('ADD-ON (Lantai Rapat)');
    await expect(body).not.toContainText('⚡ HT');
    expect(pageErrors).toEqual([]);
});

test('Viewing an archive leaves live tracker quotes on the latest market snapshot', async ({page}) => {
    const {pageErrors} = await loadDashboard(page);
    const liveQuotes = await page.evaluate(() => Object.fromEntries(
        [...(window.liveData.topVolume || []), ...(window.liveData.topGainers || [])]
            .filter(item => item?.name && item.price > 0)
            .map(item => [item.name.toUpperCase(), item.price])
    ));
    await archive(page, '2026-06-03');
    await page.waitForFunction(() => getArchiveDate() === '2026-06-03');
    const target = await page.evaluate(live => {
        const open = new Set(window.ALL_TRACKER.trades
            .filter(t => t.status === 'OPEN').map(t => (t.name || '').toUpperCase()));
        for (const item of window._archiveSnapshot?.topVolume || []) {
            const name = (item?.name || '').toUpperCase();
            const livePrice = live[name];
            if (name && open.has(name) && livePrice > 0 && item.price > 0
                && livePrice.toFixed(3) !== item.price.toFixed(3)) {
                return {name, livePrice, archivePrice: item.price};
            }
        }
        return null;
    }, liveQuotes);
    expect(target).not.toBeNull();
    await page.locator('#tab-trackerdaily').click();
    await page.locator('#tdSearchInput').fill(target.name);
    const priceCells = await page.evaluate(name => [...document.querySelectorAll('#tdMoversTableBody tr')]
        .filter(row => row.cells.length >= 13
            && (row.cells[1]?.textContent || '').toUpperCase().includes(name.toUpperCase())
            && !(row.cells[11]?.textContent || '').includes('CLOSED'))
        .map(row => row.cells[5]?.textContent.trim()), target.name);
    expect(priceCells.length).toBeGreaterThan(0);
    expect(priceCells).toContain('RM ' + target.livePrice.toFixed(3));
    expect(priceCells).not.toContain('RM ' + target.archivePrice.toFixed(3));
    expect(pageErrors).toEqual([]);
});

test('Tracker labels distinguish gross trade-return sums from net portfolio return', async ({page}) => {
    await loadDashboard(page);
    for(const id of ['frTrackerStats','htTrackerStats']) {
        await expect(page.locator('#'+id)).toContainText('Sum of Gross Returns (pp)');
        await expect(page.locator('#'+id)).not.toContainText('Total Net Profit');
    }
    await page.waitForFunction(() => document.getElementById('frStudyAddonBody')?.children.length > 0, null, {timeout:60000});
    for (const id of ['frStudyAddonBody','htStudyBody']) {
        await expect(page.locator('#'+id)).not.toContainText('Net Return');
    }
});

test('Feed-supplied stock names render as text and reach inline handlers unchanged', async ({page}) => {
    const {pageErrors} = await loadDashboard(page);
    const payload = `Q');window.__nameExecuted=1;//"><img src=x onerror="window.__nameExecuted=2">`;
    await page.locator('#tab-allmarket').click();
    await page.evaluate(name => {
        window.__historyCalls = [];
        window.triggerStockHistoryModal = value => window.__historyCalls.push(value);
        currentData[0] = {...currentData[0], name};
        document.getElementById('allMarketSearchInput').value = 'Q\');';
        renderAllMarketUniverse();
    }, payload);
    const body = page.locator('#allMarketUniverseTableBody');
    await expect(body).toContainText(payload);
    await expect(body.locator('img')).toHaveCount(0);
    await body.locator('button[onclick^="triggerStockHistoryModal"]').first().click();
    expect(await page.evaluate(() => window.__historyCalls)).toEqual([payload]);
    expect(await page.evaluate(() => window.__nameExecuted)).toBeUndefined();
    expect(pageErrors).toEqual([]);
});
