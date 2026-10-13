const {test,expect} = require('@playwright/test');
const {loadDashboard} = require('./helpers');
test('Calculator sizes a selected counter within the entered capital',async({page})=>{
    const {pageErrors}=await loadDashboard(page);
    await page.locator('#tab-calculator').click();
    const ticker=await page.locator('#calcTicker option').first().getAttribute('value');
    expect(ticker).toBeTruthy();
    await page.locator('#calcTicker').selectOption(ticker);
    await page.locator('#calcCapital').fill('2000');
    const capital=Number((await page.locator('#calcActualCapital').innerText()).replace(/[^0-9.]/g,''));
    expect(capital).toBeLessThanOrEqual(2000);
    await expect(page.locator('#calcCurrentPrice')).not.toContainText('NaN');
    expect(pageErrors).toEqual([]);
});
test('Execution study responds to changed fee assumptions',async({page})=>{
    await loadDashboard(page);
    await page.locator('#tab-trackerdaily').click();
    await expect(page.locator('#executionFeePct')).toBeVisible();
    const value=async()=>Number((await page.locator('#executionCostTotal').innerText()).replace(/[^0-9.]/g,''));
    const before=await value();
    await page.locator('#executionFeePct').fill('1');
    await page.locator('#executionFeePct').dispatchEvent('change');
    expect(await value()).toBeGreaterThan(before);
});
