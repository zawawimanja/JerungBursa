const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. Load live data
const liveDataJs = fs.readFileSync(path.join(__dirname, '../live_data.js'), 'utf8');
const sandbox = {
    window: {},
    console: {
        log: (...args) => console.log('[MOCK BROWSER LOG]:', ...args),
        warn: (...args) => console.warn('[MOCK BROWSER WARN]:', ...args),
        error: (...args) => console.error('[MOCK BROWSER ERROR]:', ...args)
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
};
sandbox.window = sandbox;
sandbox.addEventListener = (evt, cb) => { if (evt === 'DOMContentLoaded') cb(); };
sandbox.window.addEventListener = sandbox.addEventListener;

// Mock window.location
sandbox.location = { protocol: 'http:' };
sandbox.window.location = sandbox.location;

// Run live data script to populate window.liveData
vm.runInNewContext(liveDataJs, sandbox);

// Mock fetch to return liveData
sandbox.fetch = async (url) => {
    return {
        ok: true,
        json: async () => sandbox.window.liveData
    };
};
sandbox.window.fetch = sandbox.fetch;

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

// Extract and evaluate script block from index.html
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

if (!scriptCode) {
    console.error("Could not find script block containing applyFilters in index.html");
    process.exit(1);
}

// Prepare script code: mock local fetch and local storage APIs so they don't throw
sandbox.localStorage = {
    getItem: () => null,
    setItem: () => {}
};

try {
    vm.runInNewContext(scriptCode, sandbox);
    
    // Wait for the async initialization to complete
    setTimeout(() => {
        console.log("Checking tables after async loading...");
        
        const filterEl = mockElements['ipoAgeFilter'];
        const hybridTable = mockElements['hybridPicksTableBody'];
        const reversalsTable = mockElements['reversalsTableBody'];
        
        const testFilter = (filterValue) => {
            console.log(`\n--- Testing IPO Status Filter: ${filterValue} ---`);
            filterEl.value = filterValue;
            sandbox.applyFilters();
            
            if (hybridTable && hybridTable.innerHTML) {
                console.log(`✅ Hybrid picks rendered for ${filterValue}`);
                if (hybridTable.innerHTML.includes("Tiada kaunter")) {
                    console.log("   (Hybrid picks empty message shown)");
                } else {
                    const rowCount = (hybridTable.innerHTML.match(/<tr>/g) || []).length;
                    console.log(`   (Hybrid picks has ${rowCount} rows)`);
                }
            }
            
            if (reversalsTable && reversalsTable.innerHTML) {
                console.log(`✅ Reversals rendered for ${filterValue}`);
                if (reversalsTable.innerHTML.includes("No Pullback Bounce")) {
                    console.log("   (Reversals empty message shown)");
                } else {
                    const rowCount = (reversalsTable.innerHTML.match(/<tr>/g) || []).length;
                    console.log(`   (Reversals has ${rowCount} rows)`);
                }
            }
        };

        testFilter('ALL');
        testFilter('FRESH');
        testFilter('MATURE');
        testFilter('ALL_IPO');
        
        console.log("\n✅ All filter tests completed successfully!");
    }, 200);
    
} catch (e) {
    console.error("❌ Runtime Error detected in browser code:", e);
    process.exit(1);
}
