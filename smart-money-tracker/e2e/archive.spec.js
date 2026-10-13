// @ts-check
const { test, expect } = require('@playwright/test');
const { loadDashboard } = require('./helpers');

// Tetapkan tarikh arkib + cetus change secara terus (lebih robust setInputValue).
async function setArchiveDate(page, dateStr) {
  await page.evaluate((d) => {
    const el = document.getElementById('historyDate');
    el.value = d;
    el.dispatchEvent(new Event('change'));
  }, dateStr);
}

test.describe('Arkib tarikh', () => {
  test('memuat arkib hari lepas dan memaparkan butang kembali ke Live', async ({ page }) => {
    const { pageErrors } = await loadDashboard(page);

    // 2026-10-09 wujud sebagai fail history/ lokal; request luar disekat → fallback lokal.
    await setArchiveDate(page, '2026-10-09');

    const liveBtn = page.locator('#backToLiveBtn');
    await expect(liveBtn, 'butang Live patut muncul selepas arkib dimuat').toBeVisible({ timeout: 20_000 });

    const subtitle = await page.locator('#dashboardSubtitle').innerText();
    expect(subtitle).toContain('2026-10-09');

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });

  test('tarikh tanpa data arkib ditangani tanpa ranap', async ({ page }) => {
    const { pageErrors } = await loadDashboard(page);

    // Hujung minggu (Ahad) dalam julat min tetapi tiada fail lokal → Not Found, bukan ranap.
    await setArchiveDate(page, '2026-10-11');
    await page.waitForTimeout(3000);

    const btnText = await page.locator('#loadHistoryBtn').innerText();
    expect(/Not Found|Loading|Load/i.test(btnText), `teks butang tak dijangka: ${btnText}`).toBeTruthy();

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });
});
