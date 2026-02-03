import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(__dirname, '..', 'dist', 'tests');

if (!fs.existsSync(testsDir)) {
    console.error(`Tests directory not found: ${testsDir}`);
    console.error('Did you run "yarn build"?');
    process.exit(1);
}

const testFiles = fs.readdirSync(testsDir)
    .filter(file => file.endsWith('.test.js'))
    .filter(file => file !== 'run-all.js');

console.log(`Found ${testFiles.length} test files.`);

let failed = false;

for (const file of testFiles) {
    const filePath = path.join(testsDir, file);
    console.log(`\n--- Running ${file} ---`);
    try {
        execSync(`node ${filePath}`, { stdio: 'inherit' });
    } catch (error) {
        console.error(`\nTest ${file} failed.`);
        failed = true;
    }
}

if (failed) {
    console.log('\nSome tests failed.');
    process.exit(1);
} else {
    console.log('\nAll tests passed!');
}
