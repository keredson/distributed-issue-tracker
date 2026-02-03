import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { getAllIssues, getIssueById, saveComment, saveIssue, findIssueDirById, getAllIssueDirs, getFileHistory, getFileContentAtCommit, getDiff, getUserActivity } from '../utils/issues.js';
import { getLocalUsers, getCurrentLocalUser, saveProfilePicData, deleteProfilePic } from '../utils/user.js';
import { generateUniqueId } from '../utils/id.js';
import { execSync } from 'child_process';
import yaml from 'js-yaml';

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

export default defineConfig({
  root: path.resolve(__dirname), // src/web
  plugins: [
    react(),
    {
      name: 'dit-api',
      configureServer(server) {
        const issuesDir = path.join(process.cwd(), '.dit', 'issues');

        server.middlewares.use(async (req, res, next) => {
          if (!req.url) return next();

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

          // GET /api/new-id
          if (req.method === 'GET' && req.url === '/api/new-id') {
            const id = generateUniqueId(issuesDir);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ id }));
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

                  const currentUser = await getCurrentLocalUser();
                  const id = body.id || generateUniqueId();
                  const newIssue = {
                      id,
                      title: body.title,
                      body: body.body || '',
                      created: body.created || new Date().toISOString(),
                      status: 'open',
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

                  const issuePath = path.join(issuesDir, issue.dir, 'issue.yaml');
                  
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

                  fs.writeFileSync(issuePath, yaml.dump(updatedIssue, {lineWidth: -1, styles: {'!!str': 'literal'}}));

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(updatedIssue));
              } catch (err: any) {
                  console.error(err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to update issue: ' + err.message }));
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
                filePath = path.join(issuePath, 'issue.yaml');
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
                filePath = path.join(issuePath, 'issue.yaml');
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
                filePath = path.join(issuePath, 'issue.yaml');
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
            try {
                const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
                repoName = path.basename(gitRoot);
            } catch (e) {
                repoName = path.basename(process.cwd());
            }
            return html.replace('<!-- REPO_NAME_SCRIPT -->', `<script>window.repoName = "${repoName}";</script>`);
        }
    }
  ]
});
