// @ts-check
const { expect } = require('@playwright/test');

/**
 * Muat dashboard dan tunggu data live siap render.
 * Semua request cross-origin disekat supaya ujian deterministik & luar-talian
 * (arkib akan fallback ke fail history/ lokal).
 * @returns {Promise<{pageErrors: string[], consoleErrors: string[]}>}
 */
async function loadDashboard(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return route.continue();
    }
    return route.abort();
  });

  await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => !!window.liveData, null, { timeout: 60_000 });
  await page.waitForFunction(() => typeof currentData !== 'undefined' && currentData.length > 0 && !_autoRefreshBusy, null, {timeout:60000});
  await page.waitForFunction(() => typeof currentData !== 'undefined' && currentData.length > 0 && !_autoRefreshBusy, null, {timeout:60000});

  // Tunggu sekurang-kurangnya satu jadual utama terisi (applyFilters sudah jalan).
  await page
    .waitForFunction(
      () => {
        const ids = ['confluenceRadarTableBody', 'topGainersTableBody', 'frTrackerTableBody'];
        return ids.some((id) => {
          const el = document.getElementById(id);
          return el && el.querySelectorAll('tr').length > 0;
        });
      },
      null,
      { timeout: 60_000 }
    );

  return { pageErrors, consoleErrors };
}

/** Senarai 16 tab: [tabButtonId, viewId]. */
const TABS = [
  ['tab-confluence', 'view-confluence'],
  ['tab-hottheme', 'view-hottheme'],
  ['tab-fusion', 'view-fusion'],
  ['tab-allmarket', 'view-allmarket'],
  ['tab-trackerdaily', 'view-trackerdaily'],
  ['tab-jerung', 'view-jerung'],
  ['tab-realconfluence', 'view-realconfluence'],
  ['tab-topgainers', 'view-topgainers'],
  ['tab-vcp', 'view-vcp'],
  ['tab-trend', 'view-trend'],
  ['tab-spring', 'view-spring'],
  ['tab-phoenix', 'view-phoenix'],
  ['tab-fishing', 'view-fishing'],
  ['tab-portfolio', 'view-portfolio'],
  ['tab-info', 'view-info'],
  ['tab-calculator', 'view-calculator'],
];

async function rowCount(page, tbodyId) {
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    return el ? el.querySelectorAll('tr').length : -1;
  }, tbodyId);
}

module.exports = { loadDashboard, TABS, rowCount, expect };
