import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { getAllIssues, getIssueById, saveComment, saveIssue } from '../utils/issues.js';
import { getLocalUsers, getCurrentLocalUser } from '../utils/user.js';
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
            const me = await getCurrentLocalUser();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(me));
            return;
          }

          // GET /api/issues/details/:year/:month/:slug
          const detailsMatch = req.url.match(/^\/api\/issues\/details\/(\d{4})\/(\d{2})\/([^\/]+)$/);
          if (req.method === 'GET' && detailsMatch) {
            const [, , , slug] = detailsMatch;
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
                  const id = generateUniqueId();
                  const newIssue = {
                      id,
                      title: body.title,
                      body: body.body || '',
                      created: new Date().toISOString(),
                      status: 'open',
                      severity: body.severity || 'medium',
                      assignee: body.assignee || '',
                      author: currentUser?.username || ''
                  };

                  const issuePathStr = await saveIssue(newIssue, false, issuesDir);
                  const dir = path.relative(issuesDir, issuePathStr);
                  
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
                author: (body.author && body.author !== 'Web User') ? body.author : (currentUser?.username || 'Anonymous'),
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
