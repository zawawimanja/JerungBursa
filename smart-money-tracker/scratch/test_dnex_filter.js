const fs = require('fs');
const path = require('path');
const vm = require('vm');

const liveDataJs = fs.readFileSync(path.join(__dirname, '../live_data.js'), 'utf8');
const sandbox = {
    window: {},
    console: {
        log: (...args) => console.log('[LOG]:', ...args),
        warn: (...args) => console.log('[WARN]:', ...args),
        error: (...args) => console.log('[ERROR]:', ...args)
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
};
sandbox.window = sandbox;
sandbox.addEventListener = (evt, cb) => { if (evt === 'DOMContentLoaded') cb(); };
sandbox.window.addEventListener = sandbox.addEventListener;
sandbox.location = { protocol: 'http:' };
sandbox.window.location = sandbox.location;

vm.runInNewContext(liveDataJs, sandbox);

// Mock DOM elements and document
const mockElements = {};
const createMockElement = (id) => ({
    id: id,
    style: {},
    value: 'ALL',
    addEventListener: () => {},
    appendChild: () => {},
    get checked() { return false; },
    set innerHTML(html) {
        this._html = html;
    },
    get innerHTML() { return this._html || ''; }
});

sandbox.document = {
    getElementById: (id) => {
        if (!mockElements[id]) {
            mockElements[id] = createMockElement(id);
        }
        return mockElements[id];
    },
    querySelectorAll: () => [],
    createElement: () => ({ style: {} }),
    addEventListener: () => {}
};

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptCode = '';
while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1];
    if (content.includes('function applyFilters')) {
        scriptCode = content;
        break;
    }
}

sandbox.localStorage = {
    getItem: () => null,
    setItem: () => {}
};

// Mock fetch to return liveData from window
sandbox.fetch = async (url) => {
    return {
        ok: true,
        json: async () => sandbox.window.liveData
    };
};
sandbox.window.fetch = sandbox.fetch;

vm.runInNewContext(scriptCode, sandbox);

// Wait for the async initialization to complete
setTimeout(() => {
    console.log("sandbox.currentData length:", sandbox.currentData ? sandbox.currentData.length : 'undefined');
    
    const filterEl = sandbox.document.getElementById('ipoAgeFilter');
    const hybridTable = sandbox.document.getElementById('hybridPicksTableBody');
    const reversalsTable = sandbox.document.getElementById('reversalsTableBody');
    
    const checkTicker = (filterValue, ticker) => {
        filterEl.value = filterValue;
        sandbox.applyFilters();
        
        const hybridContains = hybridTable.innerHTML.includes(ticker);
        const reversalsContains = reversalsTable.innerHTML.includes(ticker);
        
        return {
            hybrid: hybridContains,
            reversals: reversalsContains,
            shown: hybridContains || reversalsContains
        };
    };

    console.log("=== IPO FILTER TESTING FOR ticker 'DNEX' ===");
    console.log("ALL:", checkTicker('ALL', 'DNEX'));
    console.log("FRESH:", checkTicker('FRESH', 'DNEX'));
    console.log("MATURE:", checkTicker('MATURE', 'DNEX'));
    console.log("ALL_IPO:", checkTicker('ALL_IPO', 'DNEX'));

    console.log("\n=== IPO FILTER TESTING FOR ticker 'NE' ===");
    console.log("ALL:", checkTicker('ALL', 'NE'));
    console.log("FRESH:", checkTicker('FRESH', 'NE'));
    console.log("MATURE:", checkTicker('MATURE', 'NE'));
    console.log("ALL_IPO:", checkTicker('ALL_IPO', 'NE'));

}, 300);
