const { test, expect } = require('@playwright/test');
const { loadDashboard } = require('./helpers');
test('Large research files load on demand and the study discloses historical coverage', async ({page}) => {
    const requests=[];page.on('request',req=>requests.push(req.url()));
    const {pageErrors}=await loadDashboard(page);
    expect(requests.some(url=>url.includes('daily_equity_tracker.js'))).toBe(false);
    expect(requests.some(url=>url.includes('execution_backtest.js'))).toBe(false);
    await page.locator('#tab-trackerdaily').click();
    await expect(page.locator('#executionModelPanel')).toContainText('T+1 execution study',{timeout:30000});
    await expect(page.locator('#executionModelPanel')).toContainText('unknown historical news coverage');
    expect(requests.some(url=>url.includes('daily_equity_tracker.js'))).toBe(true);
    expect(pageErrors).toEqual([]);
});
test('Guide explains data confidence and candidate rejection without requiring an eligible signal',async({page})=>{
    const {pageErrors}=await loadDashboard(page);
    await page.locator('#tab-info').click();
    await expect(page.locator('#dataQualitySummary')).toContainText('quote times remain unknown');
    await expect(page.locator('#signalExplainTicker option')).not.toHaveCount(0);
    await expect(page.locator('#signalExplanation')).toContainText('Fresh Rider');
    expect(pageErrors).toEqual([]);
});
test('A missing date does not lock out a subsequent valid archive request',async({page})=>{
    await loadDashboard(page);
    await page.locator('#loadHistoryBtn').click();
    await page.locator('#historyDate').fill('2026-10-09');
    await page.locator('#historyDate').dispatchEvent('change');
    await expect(page.locator('#backToLiveBtn')).toBeVisible();
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#historyDate')).toHaveValue('');
    await expect(page.locator('#backToLiveBtn')).toBeHidden();
});
