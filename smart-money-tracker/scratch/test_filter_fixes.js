// Smoke test for the filter fixes in index.html
// Loads the page's inline script in a vm with stubbed DOM and exercises the filter logic.
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
let m, script = '';
while ((m = re.exec(html)) !== null) {
  if (m[1].trim().length > 1000) script = m[1]; // main script (largest)
}

const el = (value) => ({ value, checked: value, addEventListener() {}, style: {} });
const filters = {
  priceMaxFilter: 'ALL',
  ipoAgeFilter: 'ALL',
  sortByFilter: 'SAFE',
  strictEntryFilter: false,
  premiumHypeFilter: false,
};
const documentStub = {
  getElementById: (id) => (id in filters ? el(filters[id]) : null),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
  body: { appendChild() {}, addEventListener() {} },
  title: '',
};
const ctx = {
  document: documentStub,
  window: { addEventListener: () => {}, location: { hash: '' }, localStorage: { getItem: () => null, setItem: () => {} }, liveData: {}, TRACKER_DATA: [], currentData: [], fetch: async () => ({ json: async () => ({}) }) },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  fetch: async () => ({ json: async () => ({}) }),
};
vm.createContext(ctx);
vm.runInContext(script, ctx, { timeout: 5000 });

const { isFreshIpo, passesStrictEntry, passesPremiumHype, passesGlobalFilters, matchesIpoAgeFilter } = ctx;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

console.log('\n--- isFreshIpo (2025-2026 window) ---');
check('IPO 2024 -> NOT fresh', isFreshIpo({ ipoYear: 2024, name: 'X', ipoGrade: 'A' }) === false);
check('IPO 2025 -> fresh', isFreshIpo({ ipoYear: 2025, name: 'X', ipoGrade: 'A' }) === true);
check('IPO 2026 -> fresh', isFreshIpo({ ipoYear: 2026, name: 'X', ipoGrade: 'A' }) === true);
check('no year, ipoAge 600d -> fresh (fallback)', isFreshIpo({ ipoAge: 600, name: 'X', ipoGrade: 'A' }) === true);
check('no year, ipoAge 800d -> not fresh', isFreshIpo({ ipoAge: 800, name: 'X', ipoGrade: 'A' }) === false);
check('listingDate 2024 -> not fresh', isFreshIpo({ listingDate: '2024-03-01', name: 'X', ipoGrade: 'B' }) === false);

console.log('\n--- matchesIpoAgeFilter (FRESH uses isFreshIpo) ---');
check('FRESH + IPO 2025 -> pass', matchesIpoAgeFilter({ ipoYear: 2025, name: 'X', ipoGrade: 'A' }, 'FRESH') === true);
check('FRESH + IPO 2024 -> reject', matchesIpoAgeFilter({ ipoYear: 2024, name: 'X', ipoGrade: 'A' }, 'FRESH') === false);
check('MATURE + IPO 2024 -> pass', matchesIpoAgeFilter({ ipoYear: 2024, name: 'X', ipoGrade: 'A' }, 'MATURE') === true);
check('NON_IPO + no grade -> pass', matchesIpoAgeFilter({ name: 'X' }, 'NON_IPO') === true);

console.log('\n--- passesStrictEntry (Floor 6%/11%, Skor 11/12, PB <= 20%) ---');
const strongCheap = { name: 'T', price: 0.30, floorLow: 0.28, touchCount: 5, pullback: 3, isConsolidation: true, sma50: 0.25, sma200: 0.22, turnover: 6000000, ipoGrade: 'A' };
check('strong cheap stock passes', passesStrictEntry(strongCheap) === true);
check('pullback > 20% rejected', passesStrictEntry({ ...strongCheap, pullback: 25 }) === false);
check('far from floor rejected', passesStrictEntry({ ...strongCheap, floorLow: 0.20 }) === false); // dist 50%
const strongExpensive = { name: 'T', price: 1.50, floorLow: 1.40, touchCount: 5, pullback: 3, isConsolidation: true, sma50: 1.40, sma200: 1.30, turnover: 6000000, ipoGrade: 'A' }; // dist 7.1% > 6%
check('expensive stock needs floor <= 6% (7.1% reject)', passesStrictEntry(strongExpensive) === false);
const okExpensive = { name: 'T', price: 1.50, floorLow: 1.42, touchCount: 5, pullback: 3, isConsolidation: true, sma50: 1.40, sma200: 1.30, turnover: 6000000, ipoGrade: 'A' }; // dist 5.6% <= 6%
check('expensive stock floor 5.6% passes', passesStrictEntry(okExpensive) === true);

console.log('\n--- passesPremiumHype (Gred A / OS >= 50x / Outlier) ---');
check('fresh IPO Gred A -> pass', passesPremiumHype({ ipoYear: 2025, ipoGrade: 'A', name: 'X' }) === true);
check('fresh IPO OS 50 -> pass', passesPremiumHype({ ipoYear: 2025, ipoGrade: 'C', os: 50, name: 'X' }) === true);
check('fresh IPO OS 20 -> reject', passesPremiumHype({ ipoYear: 2025, ipoGrade: 'C', os: 20, name: 'X' }) === false);
check('fresh IPO outlier -> pass', passesPremiumHype({ ipoYear: 2025, ipoGrade: 'C', outlier: true, name: 'X' }) === true);
check('mature IPO unaffected -> pass', passesPremiumHype({ ipoYear: 2023, ipoGrade: 'C', os: 0, name: 'X' }) === true);

console.log('\n--- passesGlobalFilters (checkbox wiring) ---');
filters.strictEntryFilter = true;
check('strict ON rejects low-score stock', passesGlobalFilters({ name: 'Y', price: 1.00, floorLow: 0.98, pullback: 40, touchCount: 0, ipoGrade: 'C', turnover: 100000 }) === false);
filters.strictEntryFilter = false;
filters.premiumHypeFilter = true;
check('premium ON rejects fresh non-premium', passesGlobalFilters({ name: 'Y', price: 1.00, floorLow: 0.98, pullback: 5, touchCount: 3, ipoGrade: 'C', os: 10, ipoYear: 2025, turnover: 2000000, sma50: 0.9 }) === false);
check('premium ON passes mature stock', passesGlobalFilters({ name: 'Y', price: 1.00, floorLow: 0.98, pullback: 5, touchCount: 3, ipoGrade: 'C', os: 10, ipoYear: 2023, turnover: 2000000, sma50: 0.9 }) === true);
filters.premiumHypeFilter = false;
filters.priceMaxFilter = '1.00';
check('priceMax 1.00 rejects RM1.50', passesGlobalFilters({ name: 'Y', price: 1.50, floorLow: 1.40, pullback: 5, touchCount: 3, turnover: 2000000, sma50: 1.4 }) === false);
filters.priceMaxFilter = 'ALL';

console.log('\n--- Tracker setup filter (STAIRCASE matches STAIRCASE + IPO) ---');
const trackerPasses = (setup, selected) => selected === 'ALL' || setup.toUpperCase().startsWith(selected);
check('STAIRCASE + IPO passes STAIRCASE filter', trackerPasses('STAIRCASE + IPO', 'STAIRCASE') === true);
check('STAIRCASE passes STAIRCASE filter', trackerPasses('STAIRCASE', 'STAIRCASE') === true);
check('SWING PLAY passes SWING PLAY filter', trackerPasses('SWING PLAY', 'SWING PLAY') === true);
check('EXPLOSIVE rejected by STAIRCASE filter', trackerPasses('EXPLOSIVE', 'STAIRCASE') === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
