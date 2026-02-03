import React, {useEffect, useState} from 'react';
import {Text, Box, useApp} from 'ink';
import http from 'node:http';
import open from 'open';
import { getCurrentLocalUser, savePasskey } from '../utils/user.js';

export default function WebPasskey() {
    const {exit} = useApp();
    const [status, setStatus] = useState('Starting server...');
    const [url, setUrl] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let server: http.Server;

        const start = async () => {
            const user = await getCurrentLocalUser();
            if (!user || user.isVirtual) {
                setError('No local user profile found. Please create a profile first (e.g. using the CLI) before adding a passkey.');
                return;
            }

            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Create Passkey</title>
    <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; width: 100%; max-width: 400px; }
        button { padding: 12px 24px; font-size: 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; transition: background 0.2s; width: 100%; }
        button:hover { background: #0056b3; }
        input { width: 100%; padding: 12px; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 16px; }
        #status { margin-top: 20px; color: #666; font-size: 14px; }
        h1 { margin-top: 0; }
        label { display: block; text-align: left; margin-bottom: 0.5rem; font-weight: bold; color: #444; }
        .success-bubble {
            display: none;
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            padding: 1rem;
            border-radius: 4px;
            margin-top: 1rem;
            text-align: left;
        }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Create Passkey</h1>
        <p>Creating passkey for <strong>${user.username}</strong></p>
        <div id="form-content">
            <div style="margin-bottom: 1rem;">
                <label for="keyname">Passkey Name</label>
                <input type="text" id="keyname" placeholder="e.g. My MacBook, YubiKey 5C" value="My Passkey">
            </div>
            <button id="create">Create Passkey</button>
        </div>
        <div id="success-message" class="success-bubble">
            <strong>✓ Passkey saved!</strong><br>
            You can close this tab and return to the CLI.
        </div>
        <div id="status"></div>
    </div>

    <script>
        const createBtn = document.getElementById('create');
        const keyNameInput = document.getElementById('keyname');
        const statusDiv = document.getElementById('status');
        const formContent = document.getElementById('form-content');
        const successMessage = document.getElementById('success-message');

        function bufferToBase64(buffer) {
            return btoa(String.fromCharCode(...new Uint8Array(buffer)));
        }

        createBtn.addEventListener('click', async () => {
            const keyName = keyNameInput.value.trim() || 'My Passkey';
            statusDiv.textContent = 'Opening authenticator...';
            try {
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);

                const publicKeyCredentialCreationOptions = {
                    challenge: challenge,
                    rp: {
                        name: "dit",
                        id: "localhost",
                    },
                    user: {
                        id: Uint8Array.from("${user.username}", c => c.charCodeAt(0)),
                        name: "${user.email}",
                        displayName: "${user.name}",
                    },
                    pubKeyCredParams: [{alg: -7, type: "public-key"}, {alg: -257, type: "public-key"}],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "preferred",
                        residentKey: "required",
                    },
                    timeout: 60000,
                };

                const credential = await navigator.credentials.create({
                    publicKey: publicKeyCredentialCreationOptions
                });

                statusDiv.textContent = 'Saving passkey...';

                const payload = {
                    name: keyName,
                    credential: {
                        id: credential.id,
                        rawId: bufferToBase64(credential.rawId),
                        type: credential.type,
                        response: {
                            attestationObject: bufferToBase64(credential.response.attestationObject),
                            clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
                        },
                    },
                    browser: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                    }
                };

                const res = await fetch('/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    statusDiv.textContent = '';
                    createBtn.classList.add('hidden');
                    keyNameInput.readOnly = true;
                    keyNameInput.style.background = '#f8f9fa';
                    successMessage.style.display = 'block';
                } else {
                    statusDiv.textContent = 'Error saving passkey: ' + (await res.text());
                }
            } catch (err) {
                console.error(err);
                statusDiv.textContent = 'Error: ' + err.message;
            }
        });
    </script>
</body>
</html>
            `;

            server = http.createServer((req, res) => {
                if (req.method === 'GET' && req.url === '/') {
                    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
                    res.end(html);
                } else if (req.method === 'POST' && req.url === '/save') {
                    let body = '';
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', async () => {
                        try {
                            const passkey = JSON.parse(body);
                            await savePasskey(user.username, passkey);
                            res.writeHead(200, {'Content-Type': 'text/plain'});
                            res.end('OK');
                            setStatus('Passkey saved successfully!');
                            // Give the browser a moment to receive the OK before we shut down the server
                            setTimeout(() => exit(), 2000);
                        } catch (e: any) {
                            res.writeHead(500, {'Content-Type': 'text/plain'});
                            res.end(e.message);
                        }
                    });
                } else {
                    res.writeHead(404);
                    res.end();
                }
            });

            server.listen(0, 'localhost', () => {
                const address = server.address() as any;
                const link = `http://localhost:${address.port}`;
                setUrl(link);
                setStatus('Server running');
                open(link);
            });
        };

        start();

        return () => {
            if (server) server.close();
        };
    }, []);

    if (error) {
        return (
            <Box padding={1}>
                <Text color="red">Error: {error}</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            <Text color="green">🚀 {status}</Text>
            {url && (
                <Box marginTop={1}>
                    <Text>If your browser didn't open, visit: </Text>
                    <Text color="cyan" underline>{url}</Text>
                </Box>
            )}
            <Box marginTop={1}>
                <Text color="gray">Press Ctrl+C to cancel</Text>
            </Box>
        </Box>
    );
}
