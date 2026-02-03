import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';

const issuesDir = path.join(process.cwd(), '.dit', 'test-watch-issues');
if (!fs.existsSync(issuesDir)) {
    fs.mkdirSync(issuesDir, { recursive: true });
}

console.log(`Watching ${issuesDir}`);

const watcher = chokidar.watch(issuesDir, {
    ignoreInitial: true,
    // explicitly setting recursive to true just in case, though it should be default
    // verify if chokidar 5 requires it or handles it differently
});

watcher.on('all', (event, path) => {
    console.log(`Event: ${event}, Path: ${path}`);
});

watcher.on('ready', () => {
    console.log('Watcher ready');
    
    setTimeout(() => {
        const nestedDir = path.join(issuesDir, 'nested');
        fs.mkdirSync(nestedDir);
        console.log('Created nested dir');

        setTimeout(() => {
            fs.writeFileSync(path.join(nestedDir, 'test.txt'), 'hello');
            console.log('Created file in nested dir');

            setTimeout(() => {
                watcher.close();
                // Clean up
                fs.rmSync(issuesDir, { recursive: true, force: true });
            }, 1000);
        }, 1000);
    }, 1000);
});
