const test = require('node:test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
test('Every backend, shared module and browser test script compiles without executing external actions', () => {
    const root = path.resolve(__dirname, '..');
    for (const directory of ['scripts', 'scripts/lib', 'api', 'e2e']) {
        for (const file of fs.readdirSync(path.join(root,directory)).filter(file=>file.endsWith('.js'))) {
            const filename = path.join(root,directory,file);
            new vm.Script(fs.readFileSync(filename,'utf8'), {filename});
        }
    }
});
