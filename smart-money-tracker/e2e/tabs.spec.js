// @ts-check
const { test, expect } = require('@playwright/test');
const { loadDashboard, TABS } = require('./helpers');

test.describe('Penukaran tab', () => {
  test('semua 16 tab boleh dibuka dan papar view masing-masing', async ({ page }) => {
    // Render setiap tab berat (data 5.7MB) — beri bajet masa besar.
    test.setTimeout(300_000);
    const { pageErrors } = await loadDashboard(page);

    for (const [tabId, viewId] of TABS) {
      const tabBtn = page.locator(`#${tabId}`);
      await expect(tabBtn, `tab button ${tabId} harus wujud`).toHaveCount(1);
      await tabBtn.click();

      const view = page.locator(`#${viewId}`);
      await expect(view, `view ${viewId} harus kelihatan selepas klik ${tabId}`).toBeVisible();

      // Tab yang diklik patut aktif; tab lain tidak.
      await expect(tabBtn).toHaveClass(/active/);
    }

    expect(pageErrors, `tiada ralat halaman semasa penukaran tab: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
