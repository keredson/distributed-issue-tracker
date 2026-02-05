import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'node:crypto';
import { getAllIssues, getIssueById, saveComment, saveIssue, findIssueDirById, getAllIssueDirs, getFileHistory, getFileContentAtCommit, getDiff, getUserActivity } from '../utils/issues.js';
import { loadIssueWorkflow, getDefaultIssueStatus, isTransitionAllowed, normalizeStatus } from '../utils/workflow.js';
import { getLocalUsers, getCurrentLocalUser, saveProfilePicData, deleteProfilePic } from '../utils/user.js';
import { generateUniqueId } from '../utils/id.js';
import { execSync } from 'child_process';
import yaml from 'js-yaml';
import { customAlphabet } from 'nanoid';
import { execa } from 'execa';

const WEB_TOKEN_COOKIE = 'dit_web_token';
const WEB_TOKEN = process.env.DIT_WEB_TOKEN || crypto.randomBytes(24).toString('hex');
let webTokenLogged = false;
const OAUTH_GITHUB_PATH = path.join(process.cwd(), '.dit', 'oauth', 'github.yaml');
const GITHUB_TOKENS_DIR = path.join(process.cwd(), '.dit', 'secrets', 'github');
const DEFAULT_GITHUB_SCOPES = ['read:user', 'user:email'];
const githubDeviceSessions = new Map<string, { deviceCode: string; interval: number; expiresAt: number; nextPollAt: number; username: string }>();

const parseCookies = (header: string | undefined): Record<string, string> => {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (!name) continue;
    cookies[name] = decodeURIComponent(valueParts.join('=') || '');
  }
  return cookies;
};

const buildAuthCookie = (token: string, isSecure: boolean): string => {
  const parts = [`${WEB_TOKEN_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
};

const clearAuthCookie = (isSecure: boolean): string => {
  const parts = [`${WEB_TOKEN_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
};

const readGitHubOAuthConfig = (): any | null => {
  if (!fs.existsSync(OAUTH_GITHUB_PATH)) return null;
  try {
    const content = fs.readFileSync(OAUTH_GITHUB_PATH, 'utf8');
    const parsed = yaml.load(content) as any;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
};

const sanitizeUsername = (value: string) => value.replace(/[^a-z0-9_-]/gi, '_');

const getGitHubTokenPath = (username: string) => {
  const safe = sanitizeUsername(username || 'unknown');
  return path.join(GITHUB_TOKENS_DIR, `${safe}.yaml`);
};

const readGitHubToken = (username: string): any | null => {
  const tokenPath = getGitHubTokenPath(username);
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const content = fs.readFileSync(tokenPath, 'utf8');
    const parsed = yaml.load(content) as any;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
};

const writeGitHubToken = (username: string, data: any) => {
  if (!fs.existsSync(GITHUB_TOKENS_DIR)) fs.mkdirSync(GITHUB_TOKENS_DIR, { recursive: true });
  const tokenPath = getGitHubTokenPath(username);
  fs.writeFileSync(tokenPath, yaml.dump(data, { lineWidth: -1 }), 'utf8');
  try {
    fs.chmodSync(tokenPath, 0o600);
  } catch {}
};

const deleteGitHubToken = (username: string) => {
  const tokenPath = getGitHubTokenPath(username);
  try {
    fs.unlinkSync(tokenPath);
  } catch {}
};

const registerDeviceSession = (deviceCode: string, interval: number, expiresIn: number, username: string) => {
  const deviceId = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const session = {
    deviceCode,
    interval: Math.max(1, interval),
    expiresAt: now + expiresIn * 1000,
    nextPollAt: now + Math.max(1, interval) * 1000,
    username
  };
  githubDeviceSessions.set(deviceId, session);
  return deviceId;
};

const getDeviceSession = (deviceId: string) => {
  return githubDeviceSessions.get(deviceId) || null;
};

const deleteDeviceSession = (deviceId: string) => {
  githubDeviceSessions.delete(deviceId);
};

// Helper to parse body (Connect middleware doesn't parse JSON by default)
const bodyParser = async (req: any) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: any) => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });
};

const listBranches = async (): Promise<string[]> => {
  try {
    const { stdout } = await execa('git', ['branch', '--format=%(refname:short)']);
    return stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  } catch (e) {
    return [];
  }
};

const listRemoteBranches = async (): Promise<string[]> => {
  try {
    const { stdout } = await execa('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes']);
    return stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(ref => !ref.endsWith('/HEAD'));
  } catch (e) {
    return [];
  }
};

const branchExists = async (ref: string): Promise<boolean> => {
  try {
    await execa('git', ['show-ref', '--verify', '--quiet', ref]);
    return true;
  } catch (e) {
    return false;
  }
};

const getCommitAuthorMeta = async (commitHash: string): Promise<{ name: string; email: string; date: string } | null> => {
  try {
    const { stdout } = await execa('git', ['show', '-s', '--format=%an|%ae|%ad', '--date=iso', commitHash]);
    const [name, email, date] = stdout.split('|');
    if (!name || !date) return null;
    return { name: name.trim(), email: (email || '').trim(), date: date.trim() };
  } catch (e) {
    return null;
  }
};

export default defineConfig({
  root: path.resolve(__dirname), // src/web
  plugins: [
    react(),
    {
      name: 'dit-api',
      configureServer(server) {
        if (!webTokenLogged) {
          webTokenLogged = true;
          console.log(`Web UI auth token: ${WEB_TOKEN}`);
          console.log('Open the UI with ?token=... once to set the cookie.');
        }

        const issuesDir = path.join(process.cwd(), '.dit', 'issues');

        server.middlewares.use(async (req, res, next) => {
          if (!req.url) return next();

          const authUrl = new URL(req.url, 'http://localhost');
          const pathname = authUrl.pathname;

          // Auth endpoints (no token required)
          if (req.method === 'GET' && req.url === '/api/auth/github') {
            const config = readGitHubOAuthConfig();
            const currentUser = await getCurrentLocalUser();
            const username = currentUser?.username;
            const tokenRecord = username ? readGitHubToken(username) : null;
            const user = tokenRecord?.user || null;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              configured: Boolean(config?.client_id),
              connected: Boolean(tokenRecord?.access_token),
              user,
              local_user: username || null
            }));
            return;
          }

          if (req.method === 'POST' && req.url === '/api/auth/github/logout') {
            const currentUser = await getCurrentLocalUser();
            const username = currentUser?.username;
            if (username) {
              deleteGitHubToken(username);
            }
            const isSecure = req.headers['x-forwarded-proto'] === 'https' || (req.socket as any)?.encrypted === true;
            res.setHeader('Set-Cookie', clearAuthCookie(isSecure));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (req.method === 'POST' && req.url === '/api/auth/github/device/start') {
            const config = readGitHubOAuthConfig();
            if (!config?.client_id) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing GitHub client_id. Run "dit web auth" to configure it.' }));
              return;
            }
            const currentUser = await getCurrentLocalUser();
            if (!currentUser) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'No local user found for storing GitHub token.' }));
              return;
            }

            const scopes = Array.isArray(config.scopes) && config.scopes.length > 0 ? config.scopes : DEFAULT_GITHUB_SCOPES;
            try {
              const deviceRes = await fetch('https://github.com/login/device/code', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                  client_id: config.client_id,
                  scope: scopes.join(' ')
                })
              });

              if (!deviceRes.ok) {
                throw new Error(`Device code request failed: ${deviceRes.status}`);
              }

              const deviceData = await deviceRes.json() as any;
              if (!deviceData.device_code || !deviceData.user_code || !deviceData.verification_uri) {
                throw new Error('Invalid device code response.');
              }

              const deviceId = registerDeviceSession(
                deviceData.device_code,
                deviceData.interval || 5,
                deviceData.expires_in || 900,
                currentUser.username
              );

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                device_id: deviceId,
                user_code: deviceData.user_code,
                verification_uri: deviceData.verification_uri,
                verification_uri_complete: deviceData.verification_uri_complete,
                expires_in: deviceData.expires_in,
                interval: deviceData.interval
              }));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          if (req.method === 'GET' && req.url?.startsWith('/api/auth/github/device/status')) {
            const url = new URL(req.url, 'http://localhost');
            const deviceId = url.searchParams.get('device_id');
            if (!deviceId) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', error: 'Missing device_id.' }));
              return;
            }

            const session = getDeviceSession(deviceId);
            if (!session) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', error: 'Unknown device session.' }));
              return;
            }

            const now = Date.now();
            if (now >= session.expiresAt) {
              deleteDeviceSession(deviceId);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'expired' }));
              return;
            }

            if (now < session.nextPollAt) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'pending', retry_in: Math.ceil((session.nextPollAt - now) / 1000) }));
              return;
            }

            const config = readGitHubOAuthConfig();
            if (!config?.client_id) {
              deleteDeviceSession(deviceId);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', error: 'Missing GitHub client_id.' }));
              return;
            }

            try {
              const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                  client_id: config.client_id,
                  device_code: session.deviceCode,
                  grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                })
              });

              if (!tokenRes.ok) {
                throw new Error(`Token poll failed: ${tokenRes.status}`);
              }

              const tokenData = await tokenRes.json() as any;
              if (tokenData.error) {
                if (tokenData.error === 'authorization_pending') {
                  session.nextPollAt = Date.now() + session.interval * 1000;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ status: 'pending', retry_in: session.interval }));
                  return;
                }
                if (tokenData.error === 'slow_down') {
                  session.interval = Math.min(session.interval + 5, 60);
                  session.nextPollAt = Date.now() + session.interval * 1000;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ status: 'pending', retry_in: session.interval }));
                  return;
                }
                if (tokenData.error === 'expired_token' || tokenData.error === 'access_denied') {
                  deleteDeviceSession(deviceId);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ status: 'expired', error: tokenData.error }));
                  return;
                }
                throw new Error(tokenData.error_description || tokenData.error);
              }

              if (!tokenData.access_token) {
                throw new Error('Missing access token.');
              }

              const authHeader = `Bearer ${tokenData.access_token}`;
              const userRes = await fetch('https://api.github.com/user', {
                headers: {
                  'Authorization': authHeader,
                  'User-Agent': 'dit'
                }
              });

              if (!userRes.ok) {
                throw new Error(`Failed to fetch GitHub user: ${userRes.status}`);
              }

              const user = await userRes.json() as any;
              let email = user?.email || null;

              const emailsRes = await fetch('https://api.github.com/user/emails', {
                headers: {
                  'Authorization': authHeader,
                  'User-Agent': 'dit'
                }
              });
              if (emailsRes.ok) {
                const emails = await emailsRes.json() as any[];
                const primary = emails.find(e => e.primary && e.verified) || emails.find(e => e.primary) || emails[0];
                if (primary?.email) email = primary.email;
              }

              if (user?.avatar_url) {
                try {
                  const avatarRes = await fetch(user.avatar_url);
                  if (avatarRes.ok) {
                    const contentType = avatarRes.headers.get('content-type') || undefined;
                    const buffer = Buffer.from(await avatarRes.arrayBuffer());
                    await saveProfilePicData(session.username, buffer, contentType);
                  }
                } catch {}
              }

              const tokenRecord = {
                access_token: tokenData.access_token,
                token_type: tokenData.token_type,
                scope: tokenData.scope,
                user: {
                  login: user?.login,
                  name: user?.name || user?.login,
                  email
                },
                updated_at: new Date().toISOString()
              };
              writeGitHubToken(session.username, tokenRecord);
              deleteDeviceSession(deviceId);

              const isSecure = req.headers['x-forwarded-proto'] === 'https' || (req.socket as any)?.encrypted === true;
              res.setHeader('Set-Cookie', buildAuthCookie(WEB_TOKEN, isSecure));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'approved', user: tokenRecord.user }));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', error: err.message }));
              return;
            }
          }

          const cookies = parseCookies(req.headers.cookie as string | undefined);
          const cookieToken = cookies[WEB_TOKEN_COOKIE];
          const tokenParam = authUrl.searchParams.get('token');

          if (cookieToken !== WEB_TOKEN) {
            if (tokenParam && tokenParam === WEB_TOKEN) {
              const isSecure = req.headers['x-forwarded-proto'] === 'https' || (req.socket as any)?.encrypted === true;
              res.setHeader('Set-Cookie', buildAuthCookie(WEB_TOKEN, isSecure));
              authUrl.searchParams.delete('token');
              const cleanQuery = authUrl.searchParams.toString();
              const cleanPath = authUrl.pathname + (cleanQuery ? `?${cleanQuery}` : '');
              res.statusCode = 302;
              res.setHeader('Location', cleanPath);
              res.end();
              return;
            }

            res.statusCode = 401;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DIT Web UI - Unauthorized</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f2ea;
      --panel: #fffaf2;
      --ink: #1b1b1b;
      --muted: #6a6258;
      --accent: #0f766e;
      --accent-2: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(60% 60% at 10% 10%, rgba(15,118,110,0.12), transparent 60%),
        radial-gradient(40% 40% at 90% 20%, rgba(245,158,11,0.14), transparent 60%),
        radial-gradient(30% 30% at 80% 90%, rgba(15,118,110,0.10), transparent 60%),
        var(--bg);
      color: var(--ink);
      font: 16px/1.5 "Fraunces", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
    }
    .card {
      width: min(680px, 92vw);
      background: var(--panel);
      border: 1px solid rgba(27,27,27,0.08);
      border-radius: 20px;
      padding: 28px;
      box-shadow:
        0 12px 30px rgba(0,0,0,0.08),
        inset 0 1px 0 rgba(255,255,255,0.6);
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(15,118,110,0.1);
      color: var(--accent);
      font: 600 12px/1 "system-ui", sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 16px 0 8px;
      font-size: 32px;
      line-height: 1.15;
    }
    p {
      margin: 8px 0 0;
      color: var(--muted);
      font: 500 16px/1.6 "system-ui", sans-serif;
    }
    .steps {
      margin-top: 18px;
      padding: 16px;
      border-radius: 14px;
      background: #fff;
      border: 1px dashed rgba(27,27,27,0.15);
      font: 500 15px/1.6 "system-ui", sans-serif;
    }
    .btn {
      margin-top: 10px;
      padding: 10px 16px;
      border-radius: 10px;
      border: none;
      background: var(--accent);
      color: white;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: auto;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn.btn-ghost {
      background: transparent;
      color: var(--accent);
      border: 1px solid rgba(15,118,110,0.4);
      margin-top: 0;
    }
    .btn .icon {
      width: 14px;
      height: 14px;
      margin-left: 8px;
      fill: currentColor;
      display: inline-block;
      vertical-align: -2px;
    }
    .token-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 10px;
    }
    .token-input {
      flex: 1 1 240px;
      min-width: 220px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(27,27,27,0.2);
      font: 500 14px/1.4 "system-ui", sans-serif;
    }
    code {
      background: rgba(27,27,27,0.06);
      padding: 2px 6px;
      border-radius: 6px;
      font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.95em;
    }
    .code-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .device {
      margin-top: 12px;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(27,27,27,0.12);
      background: #fff;
      display: grid;
      gap: 8px;
      justify-items: start;
    }
    .device-step {
      font: 500 15px/1.6 "system-ui", sans-serif;
      color: var(--ink);
    }
    .code {
      font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 18px;
      letter-spacing: 0.12em;
      background: rgba(27,27,27,0.06);
      padding: 6px 10px;
      border-radius: 8px;
      display: inline-block;
      width: fit-content;
    }
    .hint {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }
    .error {
      margin-top: 8px;
      color: #b42318;
      font-size: 13px;
    }
    .hidden {
      display: none;
    }
    .footer {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font: 500 13px/1.4 "system-ui", sans-serif;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent-2);
      box-shadow: 0 0 0 4px rgba(245,158,11,0.2);
    }
  </style>
</head>
<body>
  <main class="card" role="main">
    <span class="label">Unauthorized</span>
    <h1>Access Required</h1>
    <p>
      This Web UI is locked. You can unlock with a token or connect GitHub to sign in.
    </p>
    <div class="steps">
      <strong>Token option</strong><br/>
      1. Find the token in the server output.<br/>
      2. Paste it below, or open: <code>http://localhost:1337/?token=YOUR_TOKEN</code>
      <div class="token-row">
        <input id="token-input" class="token-input" type="text" placeholder="Paste token here" />
      </div>
    </div>
      <button id="github-login" class="btn">Log in with GitHub</button>
      <div class="hint" id="github-config"></div>
      <div id="github-device" class="device hidden">
        <div class="device-step"><strong>Step 1:</strong> Copy the authorization code.</div>
        <div class="code-row">
          <div class="code" id="device-code"></div>
          <button id="copy-code" class="btn btn-ghost" type="button">Copy code</button>
        </div>
        <div class="device-step"><strong>Step 2:</strong> Open GitHub and enter the code.</div>
	<button id="device-link" class="btn btn-ghost" type="button">
          Open GitHub
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 7h4v2H9v6h6v-2h2v4H7z" />
            <path d="M14 3h7v7h-2V6.41l-8.29 8.3-1.42-1.42 8.3-8.29H14z" />
          </svg>
        </button>
        <div class="hint" id="device-status">Waiting for approval…</div>
      </div>
    <div id="github-error" class="error hidden"></div>
    <div class="footer">
      <span class="dot"></span>
      Server is running. You just need the token.
    </div>
  </main>
  <script>
    const loginBtn = document.getElementById('github-login');
    const configHint = document.getElementById('github-config');
    const deviceBox = document.getElementById('github-device');
    const deviceCode = document.getElementById('device-code');
    const deviceLink = document.getElementById('device-link');
    const deviceStatus = document.getElementById('device-status');
    const errorBox = document.getElementById('github-error');
    const copyBtn = document.getElementById('copy-code');
    const tokenInput = document.getElementById('token-input');
    let deviceId = null;

    const showError = (message) => {
      errorBox.textContent = message;
      errorBox.classList.remove('hidden');
    };

    const pollStatus = async () => {
      if (!deviceId) return;
      try {
        const res = await fetch('/api/auth/github/device/status?device_id=' + encodeURIComponent(deviceId));
        const data = await res.json();
        if (data.status === 'pending') {
          const delay = Math.max(1, data.retry_in || 5);
          setTimeout(pollStatus, delay * 1000);
          return;
        }
        if (data.status === 'approved') {
          deviceStatus.textContent = 'Approved. Refreshing...';
          window.location.reload();
          return;
        }
        if (data.status === 'expired') {
          showError('Device code expired. Please try again.');
          loginBtn.disabled = false;
          return;
        }
        if (data.status === 'error') {
          showError(data.error || 'Device flow failed.');
          loginBtn.disabled = false;
        }
      } catch (e) {
        showError('Device flow failed.');
        loginBtn.disabled = false;
      }
    };

    fetch('/api/auth/github')
      .then(res => res.json())
      .then(data => {
        if (!data.configured) {
          configHint.textContent = 'Run "dit web auth" to add your GitHub client ID.';
          loginBtn.disabled = true;
        } else if (!data.local_user) {
          configHint.textContent = 'No local user detected. Configure git user.name and user.email first.';
          loginBtn.disabled = true;
        }
      })
      .catch(() => {});

    loginBtn.addEventListener('click', async () => {
      errorBox.classList.add('hidden');
      loginBtn.disabled = true;
      try {
        const res = await fetch('/api/auth/github/device/start', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          showError(data.error || 'Failed to start device flow.');
          loginBtn.disabled = false;
          return;
        }
        loginBtn.classList.add('hidden');
        deviceId = data.device_id;
        deviceCode.textContent = data.user_code;
        deviceLink.dataset.url = data.verification_uri_complete || data.verification_uri;
        deviceBox.classList.remove('hidden');
        pollStatus();
      } catch (e) {
        showError('Failed to start device flow.');
        loginBtn.disabled = false;
      }
    });

    copyBtn.addEventListener('click', async () => {
      const code = deviceCode.textContent || '';
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = 'Copied';
        setTimeout(() => {
          copyBtn.textContent = 'Copy code';
        }, 1500);
      } catch (e) {
        showError('Copy failed. Select and copy the code manually.');
      }
    });

    const tryTokenSubmit = () => {
      const token = tokenInput.value.trim();
      if (!/^[a-f0-9]{48}$/i.test(token)) return;
      const url = new URL(window.location.href);
      url.searchParams.set('token', token);
      window.location.href = url.toString();
    };

    tokenInput.addEventListener('input', () => {
      tryTokenSubmit();
    });

    tokenInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        tryTokenSubmit();
      }
    });

    deviceLink.addEventListener('click', () => {
      const url = deviceLink.dataset.url;
      if (!url) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  </script>
</body>
</html>`);
            return;
          }

          // GET /api/activity
          const activityMatch = req.url.match(/^\/api\/activity(\?.*)?$/);
          if (req.method === 'GET' && activityMatch) {
            const url = new URL(req.url, 'http://localhost');
            const username = url.searchParams.get('username');
            
            let targetUser: any;
            if (username) {
              const users = await getLocalUsers();
              targetUser = users.find(u => u.username === username);
            } else {
              targetUser = await getCurrentLocalUser();
            }

            if (targetUser) {
                const parts = new Set<string>();
                parts.add(targetUser.username);
                if (targetUser.name) parts.add(targetUser.name);
                if (targetUser.email) parts.add(targetUser.email);
                
                if (targetUser.github) {
                    if (targetUser.github.login) parts.add(targetUser.github.login);
                    if (targetUser.github.name) parts.add(targetUser.github.name);
                    if (targetUser.github.email) parts.add(targetUser.github.email);
                }
                
                const authorQuery = Array.from(parts).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\|');
                const activity = await getUserActivity(authorQuery);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(activity));
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({}));
            }
            return;
          }

          // GET /api/issues
          if (req.method === 'GET' && req.url === '/api/issues') {
            const issues = await getAllIssues(issuesDir);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(issues));
            return;
          }

          // GET /api/workflows/issue
          if (req.method === 'GET' && req.url === '/api/workflows/issue') {
            const workflow = loadIssueWorkflow();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(workflow));
            return;
          }

          // GET /api/users
          if (req.method === 'GET' && req.url === '/api/users') {
            const users = await getLocalUsers();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(users));
            return;
          }

          // GET /api/me
          if (req.method === 'GET' && req.url === '/api/me') {
            const user = await getCurrentLocalUser();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(user));
            return;
          }

          // GET /api/branches
          const branchesMatch = req.url.match(/^\/api\/branches(\?.*)?$/);
          if (req.method === 'GET' && branchesMatch) {
            const url = new URL(req.url, 'http://localhost');
            const refresh = url.searchParams.get('refresh') === '1';
            if (refresh) {
              try {
                execSync('git fetch --all --prune', { stdio: 'ignore' });
              } catch (e) {}
            }
            const branches = await listBranches();
            const remoteBranches = await listRemoteBranches();
            let currentBranch = '';
            try {
              currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            } catch (e) {}
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ branches, remoteBranches, currentBranch }));
            return;
          }

          // GET /api/new-id
          if (req.method === 'GET' && req.url === '/api/new-id') {
            const id = generateUniqueId(issuesDir);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ id }));
            return;
          }

          // GET /api/rankings
          if (req.method === 'GET' && req.url === '/api/rankings') {
            try {
              const rankingsRoot = path.join(process.cwd(), '.dit', 'rankings');
              const files: string[] = [];
              const walk = (dir: string) => {
                if (!fs.existsSync(dir)) return;
                const entries = fs.readdirSync(dir);
                for (const entry of entries) {
                  const fullPath = path.join(dir, entry);
                  const stat = fs.statSync(fullPath);
                  if (stat.isDirectory()) {
                    walk(fullPath);
                  } else if (entry.endsWith('.yaml')) {
                    files.push(fullPath);
                  }
                }
              };
              walk(rankingsRoot);

              const rankings = files.map(filePath => {
                try {
                  const content = yaml.load(fs.readFileSync(filePath, 'utf8')) as any;
                  return {
                    created: content?.created,
                    username: content?.username,
                    issues: Array.isArray(content?.issues) ? content.issues : [],
                    path: path.relative(process.cwd(), filePath)
                  };
                } catch (e) {
                  return null;
                }
              }).filter(Boolean);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(rankings));
            } catch (err: any) {
              console.error(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to load rankings: ' + err.message }));
            }
            return;
          }

          // POST /api/rankings
          if (req.method === 'POST' && req.url === '/api/rankings') {
            try {
              const body = await bodyParser(req) as any;
              const currentUser = await getCurrentLocalUser();
              const username = (currentUser?.username || 'unknown').replace(/[^a-z0-9_-]/gi, '_');
              const now = new Date();
              const year = now.getFullYear().toString();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              const rankingsDir = path.join(process.cwd(), '.dit', 'rankings', year, month, day);
              fs.mkdirSync(rankingsDir, { recursive: true });

              const issueList = Array.isArray(body.issues) ? body.issues : [];
              const rankedIssueIds = issueList.map((issue: any) => issue.id);

              const rankingId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 7)();
              const filename = `${username}-${rankingId}.yaml`;
              const targetPath = path.join(rankingsDir, filename);

              const rankingDoc = {
                version: 1,
                created: now.toISOString(),
                username: currentUser?.username || 'unknown',
                query: body.query || '',
                sort: body.sort || '',
                page: body.page || 1,
                itemsPerPage: body.itemsPerPage || issueList.length || 0,
                issues: rankedIssueIds
              };

              fs.writeFileSync(targetPath, yaml.dump(rankingDoc, { lineWidth: -1, styles: { '!!str': 'literal' } }));

              try {
                execSync(`git add "${targetPath}"`, { stdio: 'ignore' });
              } catch (e) {}

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ path: path.relative(process.cwd(), targetPath) }));
            } catch (err: any) {
              console.error(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to save ranking: ' + err.message }));
            }
            return;
          }

          // POST /api/issues/:id/data
          const dataMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/data$/);
          if (req.method === 'POST' && dataMatch) {
            const [, id] = dataMatch;
            const filename = req.headers['x-filename'] as string || 'upload';
            
            // Find or create issue directory
            let issueDir = findIssueDirById(issuesDir, id);
            let targetPath: string;

            if (issueDir) {
                targetPath = path.join(issuesDir, issueDir, 'data');
            } else {
                targetPath = path.join(issuesDir, 'data-tmp', id);
            }

            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }

            const name = filename.replace(/[^a-z0-9\._-]/gi, '_');
            const ext = path.extname(name);
            const base = path.basename(name, ext);
            let safeFilename = name;
            let finalPath = path.join(targetPath, safeFilename);
            
            if (fs.existsSync(finalPath)) {
                safeFilename = `${base}_${Date.now()}${ext}`;
                finalPath = path.join(targetPath, safeFilename);
            }
            
            const chunks: any[] = [];
            req.on('data', (chunk: any) => chunks.push(chunk));
            req.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fs.writeFileSync(finalPath, buffer);
                
                try {
                    execSync(`git add "${finalPath}"`, { stdio: 'ignore' });
                } catch (e) {}

                const url = `/api/issues/${id}/data/${safeFilename}`;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ url }));
            });
            return;
          }

          // GET /api/issues/:id/data/:filename
          const getDataMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/data\/(.+)$/);
          if (req.method === 'GET' && getDataMatch) {
            const [, id, filename] = getDataMatch;
            let issueDir = findIssueDirById(issuesDir, id);
            let filePath: string | null = null;

            if (issueDir) {
                filePath = path.join(issuesDir, issueDir, 'data', filename);
            } else {
                filePath = path.join(issuesDir, 'data-tmp', id, filename);
            }

            if (filePath && fs.existsSync(filePath)) {
                const ext = path.extname(filename).toLowerCase().slice(1);
                const mimeTypes: any = {
                    'png': 'image/png',
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'gif': 'image/gif',
                    'webp': 'image/webp',
                    'svg': 'image/svg+xml',
                    'pdf': 'application/pdf'
                };
                res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                res.end(fs.readFileSync(filePath));
            } else {
                res.statusCode = 404;
                res.end('Not found');
            }
            return;
          }

          // GET /api/issues/details/*
          const detailsMatch = req.url.match(/^\/api\/issues\/details\/(.+)$/);
          if (req.method === 'GET' && detailsMatch) {
            const slug = detailsMatch[1];
            const id = slug.split('-').pop();
            if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid ID' }));
                return;
            }
            const issue = await getIssueById(issuesDir, id);
            if (issue) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(issue));
            } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue not found' }));
            }
            return;
          }

          // POST /api/issues
          if (req.method === 'POST' && req.url === '/api/issues') {
              try {
                  const body = await bodyParser(req) as any;
                  if (!body.title) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: 'Title is required' }));
                      return;
                  }

                  const workflow = loadIssueWorkflow();
                  const defaultStatus = getDefaultIssueStatus(workflow);

                  const currentUser = await getCurrentLocalUser();
                  const id = body.id || generateUniqueId();
                  const newIssue = {
                      id,
                      title: body.title,
                      body: body.body || '',
                      created: body.created || new Date().toISOString(),
                      status: defaultStatus,
                      severity: body.severity || 'medium',
                      assignee: body.assignee || '',
                      author: currentUser?.username || 'unknown',
                      labels: body.labels || []
                  };

                  const issuePathStr = await saveIssue(newIssue, false, issuesDir);
                  const dir = path.relative(issuesDir, issuePathStr);
                  
                  // Move temp data if any
                  const tmpDataPath = path.join(issuesDir, 'data-tmp', id);
                  if (fs.existsSync(tmpDataPath)) {
                      const finalDataPath = path.join(issuePathStr, 'data');
                      if (!fs.existsSync(finalDataPath)) {
                          fs.mkdirSync(finalDataPath, { recursive: true });
                      }
                      const files = fs.readdirSync(tmpDataPath);
                      for (const file of files) {
                          fs.renameSync(path.join(tmpDataPath, file), path.join(finalDataPath, file));
                      }
                      fs.rmdirSync(tmpDataPath);
                      try {
                          execSync(`git add "${path.join(issuePathStr, 'data')}"`, { stdio: 'ignore' });
                      } catch (e) {}
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ...newIssue, dir }));
              } catch (err: any) {
                  console.error(err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to create issue: ' + err.message }));
              }
              return;
          }

          // PUT /api/issues/:id
          const putMatch = req.url.match(/^\/api\/issues\/([^\/]+)$/);
          if (req.method === 'PUT' && putMatch) {
              const [, id] = putMatch;
              try {
                  const body = await bodyParser(req) as any;
                  const issue = await getIssueById(issuesDir, id);
                  
                  if (!issue) {
                      res.statusCode = 404;
                      res.end(JSON.stringify({ error: 'Issue not found' }));
                      return;
                  }

                  if (typeof body.status === 'string') {
                      const workflow = loadIssueWorkflow();
                      const currentStatus = normalizeStatus(issue.status || '', workflow);
                      const nextStatus = normalizeStatus(body.status, workflow);
                      body.status = nextStatus;
                      if (nextStatus !== currentStatus && !isTransitionAllowed(currentStatus, nextStatus, workflow)) {
                          res.statusCode = 400;
                          res.end(JSON.stringify({ error: `Invalid status transition: ${currentStatus || '(none)'} -> ${nextStatus}` }));
                          return;
                      }
                  }

                  const issuePath = path.join(issuesDir, issue.dir, 'meta.yaml');
                  const descriptionPath = path.join(issuesDir, issue.dir, 'description.md');
                  
                  // Merge existing issue with updates
                  // We exclude fields that shouldn't be changed via simple update if any, but mostly we trust the client here
                  const updatedIssue = {
                      ...issue,
                      ...body,
                      // Ensure ID and created date don't change unless intended (usually they shouldn't)
                      id: issue.id, 
                      created: issue.created
                  };
                  
                  // Remove helper fields before saving
                  delete updatedIssue.comments;
                  delete updatedIssue.comments_count;
                  delete updatedIssue.dir;
                  delete updatedIssue.author; // Author logic is git-based, not in yaml usually, or if in yaml preserve it

                  const { body: description, ...metaOnly } = updatedIssue;
                  fs.writeFileSync(issuePath, yaml.dump(metaOnly, {lineWidth: -1, styles: {'!!str': 'literal'}}));
                  fs.writeFileSync(descriptionPath, (description || '').trim() + '\n');

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(updatedIssue));
              } catch (err: any) {
                  console.error(err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to update issue: ' + err.message }));
              }
              return;
          }

          // POST /api/issues/:id/copy
          const copyMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/copy$/);
          if (req.method === 'POST' && copyMatch) {
            const [, id] = copyMatch;
            try {
              const body = await bodyParser(req) as any;
              const targetBranch = (body.targetBranch || '').trim();
              const targetBranchesInput = Array.isArray(body.targetBranches) ? body.targetBranches : [];
              const targetBranches = targetBranchesInput
                .map((branch: any) => String(branch || '').trim())
                .filter(Boolean);
              const sourceBranch = (body.sourceBranch || '').trim();
              const commitMessage = (body.commitMessage || '').trim();

              const allTargets = targetBranches.length ? targetBranches : (targetBranch ? [targetBranch] : []);
              if (allTargets.length === 0) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'targetBranch(s) is required' }));
                return;
              }

              const issueDir = findIssueDirById(issuesDir, id);
              if (!issueDir) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue not found' }));
                return;
              }

              const issuePath = path.join(issuesDir, issueDir, 'meta.yaml');
              const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
              const relativeIssuePath = path.relative(repoRoot, issuePath);

              const sourceLogArgs = ['log'];
              if (sourceBranch) {
                sourceLogArgs.push(sourceBranch);
              }
              sourceLogArgs.push('--diff-filter=A', '-n', '1', '--format=%H', '--', relativeIssuePath);
              const { stdout: sourceHashStdout } = await execa('git', sourceLogArgs, { cwd: repoRoot });
              const sourceCommit = (sourceHashStdout || '').trim();

              if (!sourceCommit) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Source commit not found for issue file' }));
                return;
              }

              const authorMeta = await getCommitAuthorMeta(sourceCommit);
              if (!authorMeta) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to read author metadata' }));
                return;
              }

              const authorString = authorMeta.email
                ? `${authorMeta.name} <${authorMeta.email}>`
                : authorMeta.name;

              const results: any[] = [];
              const localBranches = await listBranches();
              const localSet = new Set(localBranches);
              const remoteBranches = await listRemoteBranches();
              const remoteSet = new Set(remoteBranches);

              for (const branch of allTargets) {
                let localBranchName = branch;
                let worktreeArgs: string[] = [];
                let displayBranchName = branch;
                let willCreateLocal = false;

                if (remoteSet.has(branch)) {
                  const shortName = branch.replace(/^[^/]+\//, '');
                  localBranchName = shortName;
                  displayBranchName = branch;
                  const localRef = `refs/heads/${localBranchName}`;
                  const exists = localSet.has(localBranchName) || await branchExists(localRef);
                  if (!exists) {
                    worktreeArgs = ['worktree', 'add', '-f', '-b', localBranchName, branch];
                    willCreateLocal = true;
                  } else {
                    worktreeArgs = ['worktree', 'add', '-f', localBranchName];
                  }
                } else {
                  const localRef = `refs/heads/${localBranchName}`;
                  const exists = await branchExists(localRef);
                  if (!exists) {
                    results.push({ targetBranch: branch, skipped: true, reason: 'Local branch not found' });
                    continue;
                  }
                  worktreeArgs = ['worktree', 'add', '-f', localBranchName];
                }

                const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dit-worktree-'));
                let worktreeReady = false;
                try {
                  let finalArgs: string[] = [];
                  if (worktreeArgs.includes('-b')) {
                    // git worktree add -f -b <name> <path> <commit-ish>
                    const nameIndex = worktreeArgs.indexOf('-b') + 1;
                    const branchName = worktreeArgs[nameIndex];
                    const commitish = worktreeArgs[nameIndex + 1];
                    finalArgs = ['worktree', 'add', '-f', '-b', branchName, worktreeDir, commitish];
                  } else {
                    const branchName = worktreeArgs[worktreeArgs.length - 1];
                    finalArgs = ['worktree', 'add', '-f', worktreeDir, branchName];
                  }
                  await execa('git', finalArgs, { cwd: repoRoot });
                  worktreeReady = true;
                  if (willCreateLocal) {
                    localSet.add(localBranchName);
                    try {
                      await execa('git', ['branch', '--set-upstream-to', displayBranchName, localBranchName], { cwd: repoRoot });
                    } catch (e) {}
                  }

                  await execa('git', ['checkout', sourceCommit, '--', relativeIssuePath], { cwd: worktreeDir });
                  await execa('git', ['add', relativeIssuePath], { cwd: worktreeDir });

                  const { stdout: staged } = await execa('git', ['diff', '--cached', '--name-only'], { cwd: worktreeDir });
                  if (!staged.trim()) {
                    results.push({ targetBranch: displayBranchName, skipped: true, reason: 'No changes to copy (issue already present?)' });
                    continue;
                  }

                  const baseMessage = commitMessage || `Backport issue ${id} to ${localBranchName}`;
                  const messageArgs = ['-m', baseMessage, '-m', `Cherry-picked-from: ${sourceCommit}`];
                  if (sourceBranch) {
                    messageArgs.push('-m', `Source-branch: ${sourceBranch}`);
                  }

                  await execa(
                    'git',
                    ['commit', `--author=${authorString}`, `--date=${authorMeta.date}`, ...messageArgs],
                    { cwd: worktreeDir }
                  );

                  const { stdout: newCommit } = await execa('git', ['rev-parse', 'HEAD'], { cwd: worktreeDir });
                  results.push({
                    targetBranch: displayBranchName,
                    sourceCommit,
                    commit: newCommit.trim(),
                    author: authorMeta
                  });
                } finally {
                  if (worktreeReady) {
                    try {
                      await execa('git', ['worktree', 'remove', '-f', worktreeDir], { cwd: repoRoot });
                    } catch (e) {}
                  }
                  try {
                    fs.rmSync(worktreeDir, { recursive: true, force: true });
                  } catch (e) {}
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                results
              }));
            } catch (err: any) {
              console.error(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message || 'Failed to copy issue' }));
            }
            return;
          }

          // POST /api/issues/:id/comments
          const commentMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/comments$/);
          if (req.method === 'POST' && commentMatch) {
            const [, id] = commentMatch;
            const issue = await getIssueById(issuesDir, id);
            if (!issue) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue not found' }));
                return;
            }
            
            const body = await bodyParser(req) as any;
            const currentUser = await getCurrentLocalUser();
            const commentData = {
                id: generateUniqueId(),
                author: currentUser?.username || 'unknown',
                body: body.body,
                date: new Date().toISOString()
            };

            const issuePath = path.join(issuesDir, issue.dir);
            try {
                await saveComment(issuePath, commentData);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(commentData));
            } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to save comment' }));
            }
            return;
          }

          // POST /api/issues/:id/backports
          const backportsMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/backports$/);
          if (req.method === 'POST' && backportsMatch) {
            const [, id] = backportsMatch;
            try {
              const body = await bodyParser(req) as any;
              const sourceBranch = (body.sourceBranch || '').trim();
              const branchesInput = Array.isArray(body.branches) ? body.branches : [];
              const branches = branchesInput.map((b: any) => String(b || '').trim()).filter(Boolean);

              const issueDir = findIssueDirById(issuesDir, id);
              if (!issueDir) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue not found' }));
                return;
              }

              const issuePath = path.join(issuesDir, issueDir, 'meta.yaml');
              const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
              const relativeIssuePath = path.relative(repoRoot, issuePath);

              let sourceCommit = '';
              if (sourceBranch) {
                const sourceLogArgs = ['log', sourceBranch, '--diff-filter=A', '-n', '1', '--format=%H', '--', relativeIssuePath];
                const { stdout: sourceHashStdout } = await execa('git', sourceLogArgs, { cwd: repoRoot });
                sourceCommit = (sourceHashStdout || '').trim();
              }

              const results: Record<string, { present: boolean; backported: boolean }> = {};
              for (const branch of branches) {
                let present = false;
                let backported = false;
                try {
                  const { stdout: presentStdout } = await execa('git', [
                    'log',
                    branch,
                    '--diff-filter=A',
                    '-n',
                    '1',
                    '--format=%H',
                    '--',
                    relativeIssuePath
                  ], { cwd: repoRoot });
                  present = !!presentStdout.trim();
                } catch (e) {
                  present = false;
                }

                if (sourceCommit) {
                  try {
                    const { stdout: backportStdout } = await execa('git', [
                      'log',
                      branch,
                      `--grep=Cherry-picked-from: ${sourceCommit}`,
                      '-n',
                      '1',
                      '--format=%H',
                      '--',
                      relativeIssuePath
                    ], { cwd: repoRoot });
                    backported = !!backportStdout.trim();
                  } catch (e) {
                    backported = false;
                  }
                }

                results[branch] = { present, backported };
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ sourceCommit, results }));
            } catch (err: any) {
              console.error(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message || 'Failed to check backports' }));
            }
            return;
          }

          // POST /api/issues/:id/branch-statuses
          const branchStatusesMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/branch-statuses$/);
          if (req.method === 'POST' && branchStatusesMatch) {
            const [, id] = branchStatusesMatch;
            try {
              const body = await bodyParser(req) as any;
              const branchesInput = Array.isArray(body.branches) ? body.branches : [];
              const branches = branchesInput.map((b: any) => String(b || '').trim()).filter(Boolean);

              const issueDir = findIssueDirById(issuesDir, id);
              if (!issueDir) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue not found' }));
                return;
              }

              const issuePath = path.join(issuesDir, issueDir, 'meta.yaml');
              const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
              const relativeIssuePath = path.relative(repoRoot, issuePath);

              const results: Record<string, { present: boolean; status?: string }> = {};

              for (const branch of branches) {
                try {
                  const { stdout } = await execa('git', ['show', `${branch}:${relativeIssuePath}`], { cwd: repoRoot });
                  const data: any = yaml.load(stdout || '');
                  const statusRaw = typeof data?.status === 'string' ? data.status.trim() : '';
                  results[branch] = { present: true, status: statusRaw || 'open' };
                } catch (e) {
                  results[branch] = { present: false };
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ results }));
            } catch (err: any) {
              console.error(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message || 'Failed to load branch statuses' }));
            }
            return;
          }

          // GET /api/issues/:id/history
          const historyMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/history(\?.*)?$/);
          if (req.method === 'GET' && historyMatch) {
            const [, id] = historyMatch;
            const url = new URL(req.url, 'http://localhost');
            const commentId = url.searchParams.get('commentId');
            
            const issueDirName = findIssueDirById(issuesDir, id);
            if (!issueDirName) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue not found' }));
                return;
            }

            const allDirs = getAllIssueDirs(issuesDir);
            const actualDir = allDirs.find(d => d.endsWith(`-${id}`));
            if (!actualDir) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue directory not found' }));
                return;
            }

            let filePath: string;
            const issuePath = path.join(issuesDir, actualDir);

            if (commentId) {
                // Search recursively for the comment file
                const findCommentFile = (dir: string): string | null => {
                    const items = fs.readdirSync(dir);
                    for (const item of items) {
                        const fullPath = path.join(dir, item);
                        if (fs.statSync(fullPath).isDirectory()) {
                            const found = findCommentFile(fullPath);
                            if (found) return found;
                        } else if (item.endsWith(`-${commentId}.yaml`)) {
                            // Match if it ends with -ID.yaml (works with or without comment- prefix)
                            return fullPath;
                        }
                    }
                    return null;
                };

                const foundPath = findCommentFile(issuePath);
                if (!foundPath) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Comment not found' }));
                    return;
                }
                filePath = foundPath;
            } else {
                filePath = path.join(issuePath, 'description.md');
            }

            const history = await getFileHistory(filePath);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(history));
            return;
          }

          // GET /api/issues/:id/history/content
          const historyContentMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/history\/content(\?.*)?$/);
          if (req.method === 'GET' && historyContentMatch) {
            const [, id] = historyContentMatch;
            const url = new URL(req.url, 'http://localhost');
            const commentId = url.searchParams.get('commentId');
            const commit = url.searchParams.get('commit');

            if (!commit) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Commit hash is required' }));
                return;
            }

            const allDirs = getAllIssueDirs(issuesDir);
            const actualDir = allDirs.find(d => d.endsWith(`-${id}`));
            if (!actualDir) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue not found' }));
                return;
            }

            let filePath: string;
            const issuePath = path.join(issuesDir, actualDir);

            if (commentId) {
                // Search recursively for the comment file
                const findCommentFile = (dir: string): string | null => {
                    const items = fs.readdirSync(dir);
                    for (const item of items) {
                        const fullPath = path.join(dir, item);
                        if (fs.statSync(fullPath).isDirectory()) {
                            const found = findCommentFile(fullPath);
                            if (found) return found;
                        } else if (item.endsWith(`-${commentId}.yaml`)) {
                            // Match if it ends with -ID.yaml (works with or without comment- prefix)
                            return fullPath;
                        }
                    }
                    return null;
                };

                const foundPath = findCommentFile(issuePath);
                if (!foundPath) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Comment not found' }));
                    return;
                }
                filePath = foundPath;
            } else {
                filePath = path.join(issuePath, 'description.md');
            }

            const content = await getFileContentAtCommit(filePath, commit);
            res.setHeader('Content-Type', 'text/plain');
            res.end(content);
            return;
          }

          // GET /api/issues/:id/history/diff
          const historyDiffMatch = req.url.match(/^\/api\/issues\/([^\/]+)\/history\/diff(\?.*)?$/);
          if (req.method === 'GET' && historyDiffMatch) {
            const [, id] = historyDiffMatch;
            const url = new URL(req.url, 'http://localhost');
            const commentId = url.searchParams.get('commentId');
            const commit1 = url.searchParams.get('commit1');
            const commit2 = url.searchParams.get('commit2') || 'current';

            if (!commit1) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'commit1 is required' }));
                return;
            }

            const allDirs = getAllIssueDirs(issuesDir);
            const actualDir = allDirs.find(d => d.endsWith(`-${id}`));
            if (!actualDir) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Issue not found' }));
                return;
            }

            let filePath: string;
            const issuePath = path.join(issuesDir, actualDir);

            if (commentId) {
                // Search recursively for the comment file
                const findCommentFile = (dir: string): string | null => {
                    const items = fs.readdirSync(dir);
                    for (const item of items) {
                        const fullPath = path.join(dir, item);
                        if (fs.statSync(fullPath).isDirectory()) {
                            const found = findCommentFile(fullPath);
                            if (found) return found;
                        } else if (item.endsWith(`-${commentId}.yaml`)) {
                            // Match if it ends with -ID.yaml (works with or without comment- prefix)
                            return fullPath;
                        }
                    }
                    return null;
                };

                const foundPath = findCommentFile(issuePath);
                if (!foundPath) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Comment not found' }));
                    return;
                }
                filePath = foundPath;
            } else {
                filePath = path.join(issuePath, 'description.md');
            }

            const diff = await getDiff(filePath, commit1, commit2);
            res.setHeader('Content-Type', 'text/plain');
            res.end(diff);
            return;
          }

          // GET /api/users/:username/avatar
          const avatarMatch = req.url.match(/^\/api\/users\/([^\/]+)\/avatar$/);
          if (req.method === 'GET' && avatarMatch) {
            const [, username] = avatarMatch;
            const userDir = path.join(process.cwd(), '.dit', 'users', username);
            const possiblePics = ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp', 'avatar.gif'];
            
            let found = false;
            for (const pic of possiblePics) {
              const picPath = path.join(userDir, pic);
              if (fs.existsSync(picPath)) {
                const ext = path.extname(pic).toLowerCase().slice(1);
                const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
                res.setHeader('Content-Type', contentType);
                res.end(fs.readFileSync(picPath));
                found = true;
                break;
              }
            }
            if (!found) {
              res.statusCode = 404;
              res.end('Not found');
            }
            return;
          }

          // GET /api/users/:username
          const userMatch = req.url.match(/^\/api\/users\/([^\/]+)$/);
          if (req.method === 'GET' && userMatch) {
            const [, username] = userMatch;
            const users = await getLocalUsers();
            const user = users.find(u => u.username === username);
            if (user) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(user));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'User not found' }));
            }
            return;
          }

          // POST /api/users/:username/avatar
          const postAvatarMatch = req.url.match(/^\/api\/users\/([^\/]+)\/avatar$/);
          if (req.method === 'POST' && postAvatarMatch) {
            const [, username] = postAvatarMatch;
            const currentUser = await getCurrentLocalUser();
            
            if (currentUser?.username !== username) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }

            const contentType = req.headers['content-type'];
            const chunks: any[] = [];
            req.on('data', (chunk: any) => chunks.push(chunk));
            req.on('end', async () => {
              try {
                const buffer = Buffer.concat(chunks);
                await saveProfilePicData(username, buffer, contentType);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          // DELETE /api/users/:username/avatar
          const deleteAvatarMatch = req.url.match(/^\/api\/users\/([^\/]+)\/avatar$/);
          if (req.method === 'DELETE' && deleteAvatarMatch) {
            const [, username] = deleteAvatarMatch;
            const currentUser = await getCurrentLocalUser();
            
            if (currentUser?.username !== username) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }

            try {
              await deleteProfilePic(username);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          next();
        });
      }
    },
    {
        name: 'repo-name-injector',
        transformIndexHtml(html) {
            let repoName = 'LOCAL REPO';
            let repoRef = '';
            try {
                const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
                repoName = path.basename(gitRoot);
                const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
                if (branch && branch !== 'HEAD') {
                    repoRef = branch;
                } else {
                    repoRef = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
                }
            } catch (e) {
                repoName = path.basename(process.cwd());
            }
            return html.replace('<!-- REPO_NAME_SCRIPT -->', `<script>window.repoName = "${repoName}"; window.repoRef = "${repoRef}";</script>`);
        }
    }
  ]
});
