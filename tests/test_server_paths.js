import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Simulate paths in dashboard_server.ts
const serverDir = path.join(projectRoot, 'dist', 'src', 'commands');
const cwd = projectRoot;

console.log('Simulating dashboard_server.ts paths:');
console.log('__dirname (simulated):', serverDir);
console.log('process.cwd():', cwd);

let templatePath = path.join(serverDir, 'dashboard.html');
let jsxPath = path.join(serverDir, 'dashboard.jsx');

console.log('Default templatePath:', templatePath);
console.log('Default jsxPath:', jsxPath);

const devTemplatePath = path.join(cwd, 'src/commands/dashboard.html');
if (fs.existsSync(devTemplatePath)) {
    console.log('Found dev template:', devTemplatePath);
    templatePath = devTemplatePath;
}

const devJsxPath = path.join(cwd, 'src/commands/dashboard.jsx');
if (fs.existsSync(devJsxPath)) {
    console.log('Found dev JSX:', devJsxPath);
    jsxPath = devJsxPath;
}

console.log('Final templatePath:', templatePath);
console.log('Final jsxPath:', jsxPath);

if (!fs.existsSync(jsxPath)) {
    console.error('ERROR: jsxPath does not exist!');
    process.exit(1);
} else {
    console.log('OK: jsxPath exists.');
}
