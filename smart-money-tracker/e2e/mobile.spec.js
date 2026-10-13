// @ts-check
const { test, expect } = require('@playwright/test');
const { loadDashboard } = require('./helpers');

test.describe('Paparan telefon', () => {
  test('tiada limpahan melintang & tab boleh dicapai', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Ujian susun atur khusus telefon');

    const { pageErrors } = await loadDashboard(page);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    // Tolak 2px untuk bundaran/sub-pixel.
    expect(
      metrics.scrollWidth,
      `tiada limpahan melintang (scrollWidth ${metrics.scrollWidth} > innerWidth ${metrics.innerWidth})`
    ).toBeLessThanOrEqual(metrics.innerWidth + 2);

    // Bar navigasi tab wujud dan boleh skrol pada skrin kecil.
    const tabsNav = page.locator('.tabs-nav');
    await expect(tabsNav).toBeVisible();

    // Buka satu tab pada telefon.
    await page.locator('#tab-portfolio').click();
    await expect(page.locator('#view-portfolio')).toBeVisible();

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });
});
