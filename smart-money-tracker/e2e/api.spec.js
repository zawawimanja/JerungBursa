const { test, expect } = require('@playwright/test');
const { loadDashboard } = require('./helpers');
test('Browser AI request retries a busy primary model and returns the fallback response', async ({page}) => {
    const {pageErrors} = await loadDashboard(page);
    const requests = [];
    await page.route('**/api/chat', async route => {
        const body = route.request().postDataJSON(); requests.push(body);
        await route.fulfill({status:requests.length === 1 ? 503 : 200,contentType:'application/json',body:JSON.stringify(requests.length === 1 ? {error:'Busy test provider'} : {text:'Offline fallback confirmed'})});
    });
    const answer = await page.evaluate(() => callGroqWithFallback('llama-3.3-70b-versatile','llama-3.1-8b-instant','Test context','Test question'));
    expect(answer.text).toBe('Offline fallback confirmed');
    expect(answer.model).toBe('llama-3.1-8b-instant');
    expect(requests.map(body=>body.model)).toEqual(['llama-3.3-70b-versatile','llama-3.1-8b-instant']);
    expect(pageErrors).toEqual([]);
});
test('Test server enforces private file and path protections', async ({request}) => {
    for (const file of ['/.env','/user_portfolio.json','/portfolio_alerts_history.json','/node_modules/axios/package.json']) {
        expect((await request.get(file)).status()).toBe(404);
    }
});
