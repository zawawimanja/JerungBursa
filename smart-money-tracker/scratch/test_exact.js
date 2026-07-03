const fs = require('fs');
const path = require('path');
const vm = require('vm');

const liveDataJs = fs.readFileSync(path.join(__dirname, '../live_data.js'), 'utf8');
const sandbox = {
    window: {},
    console: {
        log: () => {},
        warn: () => {},
        error: () => {}
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

sandbox.fetch = async (url) => {
    return {
        ok: true,
        json: async () => sandbox.window.liveData
    };
};
sandbox.window.fetch = sandbox.fetch;

vm.runInNewContext(scriptCode, sandbox);

setTimeout(() => {
    const filterEl = sandbox.document.getElementById('ipoAgeFilter');
    const hybridTable = sandbox.document.getElementById('hybridPicksTableBody');
    const reversalsTable = sandbox.document.getElementById('reversalsTableBody');
    
    const printRenderedTickers = (filterValue) => {
        filterEl.value = filterValue;
        sandbox.applyFilters();
        
        console.log(`\n--- Rendered Tickers for filter: ${filterValue} ---`);
        
        // Extract tickers using TradingView symbol link (MYX:TICKER)
        const myxRegex = /MYX:(\w+)/g;
        let m;
        
        const hybridNames = new Set();
        while ((m = myxRegex.exec(hybridTable.innerHTML)) !== null) {
            hybridNames.add(m[1]);
        }
        
        const revNames = new Set();
        while ((m = myxRegex.exec(reversalsTable.innerHTML)) !== null) {
            revNames.add(m[1]);
        }
        
        console.log("Hybrid Picks:", Array.from(hybridNames));
        console.log("Reversals:", Array.from(revNames));
    };

    printRenderedTickers('ALL');
    printRenderedTickers('FRESH');
    printRenderedTickers('MATURE');
    printRenderedTickers('ALL_IPO');

}, 300);
