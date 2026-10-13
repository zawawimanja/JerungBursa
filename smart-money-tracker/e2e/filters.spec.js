// @ts-check
const { test, expect } = require('@playwright/test');
const { loadDashboard, rowCount } = require('./helpers');

test.describe('Filter dashboard', () => {
  test('filter harga global mengecilkan set Fresh Rider; sort tidak mengubah bilangan', async ({ page }) => {
    const { pageErrors } = await loadDashboard(page);

    await page.locator('#tab-confluence').click();
    const tbody = 'confluenceRadarTableBody';

    const baseline = await rowCount(page, tbody);
    expect(baseline).toBeGreaterThan(0);

    // Had harga maksimum hanya boleh buang baris, bukan tambah.
    await page.selectOption('#priceMaxFilter', '0.50');
    const capped = await rowCount(page, tbody);
    expect(capped).toBeLessThanOrEqual(baseline);

    // Sort menyusun semula tetapi tidak mengubah saiz set.
    await page.selectOption('#priceMaxFilter', 'ALL');
    const beforeSort = await rowCount(page, tbody);
    await page.selectOption('#sortByFilter', 'TURNOVER');
    const afterSort = await rowCount(page, tbody);
    expect(afterSort).toBe(beforeSort);

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });

  test('had Top Gainers menghadkan bilangan baris', async ({ page }) => {
    const { pageErrors } = await loadDashboard(page);

    await page.locator('#tab-topgainers').click();
    const tbody = 'topGainersTableBody';

    await page.selectOption('#topGainersLimitFilter', '100');
    const wide = await rowCount(page, tbody);

    await page.selectOption('#topGainersLimitFilter', '30');
    const narrow = await rowCount(page, tbody);

    expect(narrow).toBeLessThanOrEqual(wide);
    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });

  test('carian All Market mengecilkan senarai', async ({ page }) => {
    const { pageErrors } = await loadDashboard(page);

    await page.locator('#tab-allmarket').click();
    const tbody = 'allMarketUniverseTableBody';
    const baseline = await rowCount(page, tbody);
    expect(baseline).toBeGreaterThan(0);

    // Cari rentetan yang hampir pasti tiada padanan → baris berkurang/kosong.
    await page.fill('#allMarketSearchInput', 'ZZZQXQTIDAKWUJUD999');
    await page.waitForTimeout(300);
    const filtered = await rowCount(page, tbody);
    expect(filtered).toBeLessThanOrEqual(baseline);

    // Kosongkan → kembali ke asal.
    await page.fill('#allMarketSearchInput', '');
    await page.waitForTimeout(300);
    const restored = await rowCount(page, tbody);
    expect(restored).toBe(baseline);

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });
});
