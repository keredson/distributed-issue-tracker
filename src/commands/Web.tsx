import React, {useEffect, useState} from 'react';
import {Text, Box} from 'ink';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '../../');
const repoRoot = process.cwd();
const OAUTH_DIR = path.join(repoRoot, '.dit', 'oauth');
const SECRETS_DIR = path.join(repoRoot, '.dit', 'secrets');
const GITHUB_OAUTH_PATH = path.join(OAUTH_DIR, 'github.yaml');

export default function Web() {
    const [status, setStatus] = useState('Starting Vite server...');
    const [serverLogs, setServerLogs] = useState<string[]>([]);

    useEffect(() => {
        let viteProcess: ChildProcess | null = null;

        let openedBrowser = false;

        const openBrowser = async (url: string) => {
            if (openedBrowser) return;
            openedBrowser = true;
            try {
                await open(url, { wait: false });
            } catch (err) {
                openedBrowser = false;
                setStatus(`Server running at http://localhost:1337 (failed to open browser)`);
            }
        };

        const startVite = () => {
            const webPath = path.join(appRoot, 'src/web');
            
            if (!fs.existsSync(webPath)) {
                setStatus(`Error: Web directory not found at ${webPath}`);
                return;
            }

            if (fs.existsSync(SECRETS_DIR)) {
                const stat = fs.statSync(SECRETS_DIR);
                if (!stat.isDirectory()) {
                    setStatus(`Error: ${SECRETS_DIR} exists and is not a directory.`);
                    return;
                }
            }

            const args = [webPath, '--port', '1337'];
            const webToken = crypto.randomBytes(24).toString('hex');
            
            const env = { ...process.env };
            const localBin = path.join(appRoot, 'node_modules/.bin');
            env.PATH = `${localBin}${path.delimiter}${env.PATH}`;
            env.DIT_WEB_TOKEN = env.DIT_WEB_TOKEN || webToken;
            const authConfigured = fs.existsSync(GITHUB_OAUTH_PATH);
            if (!authConfigured) {
                const tokenUrl = `http://localhost:1337/?token=${env.DIT_WEB_TOKEN}`;
                setServerLogs(prev => [...prev.slice(-15), `[Auth] Token URL: ${tokenUrl}`]);
            }

            viteProcess = spawn('vite', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true,
                env
            });

            setStatus(`Vite server started (PID: ${viteProcess.pid})`);

            const handleLog = (data: any, isErr = false) => {
                const lines = data.toString().split('\n');
                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;

                    const prefix = isErr ? '[Vite ERR]' : '[Vite]';
                    setServerLogs(prev => [...prev.slice(-15), `${prefix} ${line}`]);
                    
                    if (line.includes('Local:') || line.includes('http://localhost:1337')) {
                        setStatus('Server running at http://localhost:1337');
                        if (env.DIT_WEB_TOKEN && !env.DIT_WEB_TOKEN.startsWith('$')) {
                            const openUrl = authConfigured
                                ? 'http://localhost:1337'
                                : `http://localhost:1337/?token=${env.DIT_WEB_TOKEN}`;
                            void openBrowser(openUrl);
                        }
                    }
                }
            };

            viteProcess.stdout?.on('data', (data) => handleLog(data));
            viteProcess.stderr?.on('data', (data) => handleLog(data, true));

            viteProcess.on('exit', (code) => {
                if (code !== 0 && code !== null) {
                    setStatus(`Vite exited with code ${code}`);
                }
            });
        };

        startVite();

        return () => {
            if (viteProcess) {
                // Try to kill the whole process group since shell:true spawn
                try {
                    process.kill(-viteProcess.pid!, 'SIGTERM');
                } catch (e) {
                    viteProcess.kill();
                }
            }
        };
    }, []);

    return (
        <Box flexDirection="column" padding={1}>
            <Text color="green">🚀 {status}</Text>
            <Text color="blue">✨ Powered by Vite</Text>
            <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
                {serverLogs.map((log, i) => (
                    <Text key={i} color="gray">{log}</Text>
                ))}
            </Box>
            <Text color="gray">Press Ctrl+C to stop the server</Text>
        </Box>
    );
}
