// @ts-check
const { test, expect } = require('@playwright/test');
const { loadDashboard } = require('./helpers');

test.describe('Dashboard smoke', () => {
  test('loads live data without fatal page errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await loadDashboard(page);

    // Data live dimuat sebagai script tag; tunggu window.liveData tersedia.
    await page.waitForFunction(() => !!window.liveData, null, { timeout: 60_000 });

    const meta = await page.evaluate(() => ({
      source: window.liveData.source,
      lastUpdated: window.liveData.lastUpdated,
      topVolume: Array.isArray(window.liveData.topVolume) ? window.liveData.topVolume.length : 0,
    }));

    console.log('SMOKE META', JSON.stringify(meta));
    console.log('SMOKE PAGE ERRORS', JSON.stringify(pageErrors.slice(0, 10)));

    expect(meta.lastUpdated).toBeTruthy();
    expect(pageErrors).toEqual([]);
  });
});
