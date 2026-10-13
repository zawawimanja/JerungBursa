const { execFile } = require('child_process');
const path = require('path');
const { runMarketPipeline } = require('./lib/market_pipeline');

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = execFile(command, args, {
            cwd: path.resolve(__dirname, '..'), windowsHide: true,
            maxBuffer: 10 * 1024 * 1024
        }, error => error ? reject(error) : resolve());
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
    });
}

if (require.main === module) {
    runMarketPipeline(run).catch(error => {
        console.error(`Market pipeline failed: ${error.message}`);
        process.exitCode = 1;
    });
}
