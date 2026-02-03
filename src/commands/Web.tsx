import React, {useEffect, useState} from 'react';
import {Text, Box} from 'ink';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';

export default function Web() {
    const [status, setStatus] = useState('Starting Vite server...');
    const [serverLogs, setServerLogs] = useState<string[]>([]);

    useEffect(() => {
        let viteProcess: ChildProcess | null = null;

        const startVite = () => {
            const args = ['vite', 'src/web', '--port', '1337'];
            
            // If watch is explicitly requested or implied, Vite does it.
            // We'll use the 'open' package in the main process if we want, or just let Vite do it?
            // If we let Vite do it: args.push('--open');
            
            // args.push('--open'); 
            
            viteProcess = spawn('npx', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true
            });

            setStatus(`Vite server started (PID: ${viteProcess.pid})`);

            viteProcess.stdout?.on('data', (data) => {
                const msg = data.toString().trim();
                // Vite outputs color codes, we might want to strip them for simple Ink logging or keep them
                // For now, simple log
                if (msg) setServerLogs(prev => [...prev.slice(-5), `[Vite] ${msg}`]);
                if (msg.includes('Local:')) {
                    setStatus('Server running at http://localhost:1337');
                }
            });

            viteProcess.stderr?.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) setServerLogs(prev => [...prev.slice(-5), `[Vite ERR] ${msg}`]);
            });

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
