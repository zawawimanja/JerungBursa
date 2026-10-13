// @ts-check
const { test, expect } = require('@playwright/test');
const { loadDashboard, rowCount } = require('./helpers');

test.describe('Portfolio', () => {
  test('sync menunjukkan amaran (tidak ranap) apabila tiada Top Ranking picks', async ({ page }) => {
    const { pageErrors } = await loadDashboard(page);

    const dialogs = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.accept();
    });

    // Keadaan data sebenar: jika _latestFreshRiderPicks kosong, sync mesti beri amaran.
    const picksLen = await page.evaluate(
      () => (Array.isArray(window._latestFreshRiderPicks) ? window._latestFreshRiderPicks.length : 0)
    );

    await page.evaluate(() => localStorage.removeItem('my_active_portfolio'));
    await page.locator('#tab-portfolio').click();
    await page.locator('#btn-sync-portfolio-top').click();
    await page.waitForTimeout(500);

    if (picksLen < 2) {
      expect(dialogs.join(' | '), 'amaran patut muncul bila picks kurang').toMatch(/belum selesai|Kurang/i);
      const stored = await page.evaluate(() => localStorage.getItem('my_active_portfolio'));
      expect(stored, 'tiada tulisan bila sync gagal').toBeFalsy();
    } else {
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('my_active_portfolio') || '[]'));
      expect(stored.length).toBeGreaterThan(0);
    }

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });

  test('tambah (sync) lalu tuai 50%: jualan direkod & SL dianjak ke breakeven', async ({ page }) => {
    const { pageErrors } = await loadDashboard(page);

    page.on('dialog', async (d) => {
      if (d.type() === 'prompt') return d.accept('1.000');
      return d.accept();
    });

    // Seed picks dengan 2 kaunter SEBENAR dari currentData supaya journey tambah/jual
    // boleh diuji tanpa bergantung kepada ketersediaan Top Ranking VVIP hari ini.
    const seeded = await page.evaluate(() => {
      // `currentData` ialah binding skop-skrip (bukan window.currentData).
      const cd = (typeof currentData !== 'undefined' && Array.isArray(currentData) ? currentData : [])
        .filter((x) => x && x.name && Number.isFinite(x.price) && x.price > 0);
      window._latestFreshRiderPicks = cd.slice(0, 2).map((x) => ({ name: x.name, price: x.price, floorLow: x.floorLow || 0 }));
      return window._latestFreshRiderPicks.map((p) => p.name);
    });
    expect(seeded.length, 'perlu 2 kaunter sebenar untuk seed').toBeGreaterThanOrEqual(2);

    await page.evaluate(() => localStorage.removeItem('my_active_portfolio'));
    await page.locator('#tab-portfolio').click();
    await page.locator('#btn-sync-portfolio-top').click();
    await page.waitForTimeout(500);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('my_active_portfolio') || '[]'));
    expect(stored.length, 'sync simpan pegangan aktif').toBeGreaterThan(0);
    expect(await rowCount(page, 'portfolioTableBody')).toBeGreaterThan(0);

    const sellBtn = page.locator('#portfolioTableBody button', { hasText: /Tuai 50%/ }).first();
    await expect(sellBtn, 'butang Tuai 50% harus wujud').toBeVisible();
    await sellBtn.click();
    await page.waitForTimeout(500);

    const realized = await page.evaluate(() => JSON.parse(localStorage.getItem('my_realized_portfolio') || '[]'));
    expect(realized.length, 'jualan 50% direkod dalam realized portfolio').toBeGreaterThan(0);

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('my_active_portfolio') || '[]'));
    const scaled = after.find((p) => p.isScaledOut);
    expect(scaled, 'satu pegangan bertanda isScaledOut').toBeTruthy();
    expect(scaled.slPrice, 'SL dianjak ke breakeven').toBeCloseTo(scaled.buyPrice, 3);

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });
});
