import React, {useState, useEffect} from 'react';
import {Text, Box, useApp, useInput} from 'ink';
import {Octokit} from '@octokit/rest';
import {execa} from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {generateUniqueId} from '../utils/id.js';
import {saveIssue, saveComment, findCommentByExternalId, getCommentCountForIssue, getAllIssueDirs} from '../utils/issues.js';
import {createUser, getLocalUsers, saveProfilePic, saveExternalMetadata} from '../utils/user.js';

type Props = {
    url?: string;
    skipAdd?: boolean;
    verbose?: boolean;
    all?: boolean;
    users?: boolean;
};

export default function Import({url: initialUrl, skipAdd, verbose, all, users: usersOnly}: Props) {
    const [status, setStatus] = useState<string>('');
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [repoUrl, setRepoUrl] = useState<string | null>(initialUrl || null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const {exit} = useApp();

    const addLog = (msg: string) => {
        if (verbose) {
            setLogs(prev => [...prev.slice(-15), msg]);
        }
        setStatus(msg);
    };

    const getDitVersion = (): string => {
        try {
            const pkgPath = path.join(process.cwd(), 'package.json');
            const raw = fs.readFileSync(pkgPath, 'utf8');
            const pkg = JSON.parse(raw);
            return typeof pkg.version === 'string' ? pkg.version : 'unknown';
        } catch (e) {
            return 'unknown';
        }
    };
    const ditVersion = getDitVersion();

    const buildExternalIndex = (issuesDir: string): Map<string, { dir: string; importAt?: number }> => {
        const index = new Map<string, { dir: string; importAt?: number }>();
        const dirs = getAllIssueDirs(issuesDir);
        for (const dir of dirs) {
            const metaPath = path.join(issuesDir, dir, 'meta.yaml');
            if (!fs.existsSync(metaPath)) continue;
            try {
                const content = fs.readFileSync(metaPath, 'utf8');
                const meta = yaml.load(content) as any;
                if (!meta || !meta.external_id) continue;
                const rawAt = meta.import?.at;
                const parsedAt = rawAt ? Date.parse(rawAt) : NaN;
                const importAt = Number.isFinite(parsedAt) ? parsedAt : undefined;
                index.set(String(meta.external_id), { dir: path.join(issuesDir, dir), importAt });
            } catch (e) {
                // Ignore parse errors
            }
        }
        return index;
    };

    const updateIssueImport = async (issueDirPath: string, externalId: string, importedAt: string) => {
        const metaPath = path.join(issueDirPath, 'meta.yaml');
        if (!fs.existsSync(metaPath)) return;
        try {
            const content = fs.readFileSync(metaPath, 'utf8');
            const meta = (yaml.load(content) as any) || {};
            meta.external_id = externalId;
            meta.import = {
                src: 'github.com',
                at: importedAt,
                dit_version: ditVersion,
                external_id: externalId
            };
            fs.writeFileSync(metaPath, yaml.dump(meta, {lineWidth: -1, styles: {'!!str': 'literal'}}));
            if (!skipAdd) {
                try {
                    await execa('git', ['add', metaPath]);
                } catch (e) {
                    // Ignore
                }
            }
        } catch (e) {
            // Ignore write errors
        }
    };

    useEffect(() => {
        const detectUrl = async () => {
            if (!repoUrl) {
                try {
                    const {stdout} = await execa('git', ['config', '--get', 'remote.origin.url']);
                    setRepoUrl(stdout.trim());
                } catch (e) {
                    setError('Could not detect GitHub URL from git remote origin. Please provide it manually.');
                }
            }
        };
        detectUrl();
    }, []);

    useEffect(() => {
        if (isConfirmed && repoUrl) {
            importGitHubIssues(repoUrl);
        }
    }, [isConfirmed]);

    const parseGitHubUrl = (githubUrl: string) => {
        try {
            // Handle SSH URLs like git@github.com:owner/repo.git
            if (githubUrl.startsWith('git@github.com:')) {
                const parts = githubUrl.slice('git@github.com:'.length).replace(/\.git$/, '').split('/');
                if (parts.length === 2) return {owner: parts[0], repo: parts[1]};
            }
            
            const urlObj = new URL(githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`);
            if (urlObj.hostname !== 'github.com') return null;
            const parts = urlObj.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
            if (parts.length < 2) return null;
            return {owner: parts[0], repo: parts[1]};
        } catch (e) {
            return null;
        }
    };

    const syncUser = async (githubUser: any) => {
        if (!githubUser) return null;
        const localUsers = await getLocalUsers();
        const username = githubUser.login;
        const exists = localUsers.find(u => u.username === username);
        
        if (!exists) {
            if (verbose) addLog(`Creating local user profile for ${username}...`);
            
            const userData: any = {
                name: githubUser.name || githubUser.login
            };
            
            // Only add email if it's available and not a placeholder noreply email
            if (githubUser.email && !githubUser.email.endsWith('@users.noreply.github.com')) {
                userData.email = githubUser.email;
            }

            await createUser(username, userData, githubUser.avatar_url);
        } else if (githubUser.avatar_url) {
            // Update profile pic if it changed or if we are in usersOnly mode
            if (verbose) addLog(`Syncing profile pic for ${username}...`);
            await saveProfilePic(username, githubUser.avatar_url);
        }
        
        // Save full GitHub metadata
        await saveExternalMetadata(username, {
            src: 'github.com',
            at: new Date().toISOString(),
            dit_version: ditVersion,
            external_id: username
        });
        
        return username;
    };

    const importGitHubIssues = async (githubUrl: string) => {
        const repoInfo = parseGitHubUrl(githubUrl);
        if (!repoInfo) {
            setError(`Invalid GitHub URL: ${githubUrl}. Expected format: https://github.com/owner/repo or git@github.com:owner/repo.git`);
            return;
        }

        let token = process.env['GITHUB_TOKEN'];
        if (!token) {
            try {
                const {stdout} = await execa('gh', ['auth', 'token']);
                token = stdout.trim();
                if (verbose) addLog('Using token from GitHub CLI (gh).');
            } catch (e) {
                // gh not installed or not logged in, continue anonymously
            }
        } else if (verbose) {
            addLog('Using GITHUB_TOKEN for authentication.');
        }

        if (!token) {
            addLog('Tip: Log in with "gh auth login" or set GITHUB_TOKEN to avoid rate limits.');
        }

        const octokit = new Octokit({
            auth: token
        });
        const {owner, repo} = repoInfo;

        try {
            addLog(`Fetching ${all ? 'all' : 'open'} issues from ${owner}/${repo}...`);
            const issues = await octokit.paginate(octokit.issues.listForRepo, {
                owner,
                repo,
                state: all ? 'all' : 'open',
                per_page: 100,
            });

            const issuesDir = path.join('.dit', 'issues');
            const externalIndex = buildExternalIndex(issuesDir);
            const issueItems = issues
                .filter(issue => !issue.pull_request)
                .map(issue => {
                    const externalId = `${owner}/${repo}#${issue.number}`;
                    const existing = externalIndex.get(externalId);
                    const importAt = Number.isFinite(existing?.importAt) ? (existing?.importAt as number) : 0;
                    const isNew = !existing;
                    return { issue, externalId, isNew, importAt };
                })
                .sort((a, b) => {
                    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
                    return a.importAt - b.importAt;
                });

            addLog(`Found ${issues.length} issues/PRs (${issueItems.length} issues). ${usersOnly ? 'Syncing users...' : 'Importing...'} (prioritized new and stale)`);

            for (const { issue, externalId, isNew } of issueItems) {
                if (usersOnly) {
                    await syncUser(issue.assignee);
                    await syncUser(issue.user);
                } else {
                    const importedAt = new Date().toISOString();
                    
                    let issueDirPath = isNew ? null : externalIndex.get(externalId)?.dir || null;
                    
                    if (!issueDirPath) {
                        addLog(`Processing issue #${issue.number}: ${issue.title}...`);
                        const assignee = await syncUser(issue.assignee);
                        
                        const issueData = {
                            id: generateUniqueId(),
                            external_id: externalId,
                            title: issue.title,
                            created: issue.created_at,
                            status: issue.state === 'closed' ? 'closed' : 'open',
                            severity: 'medium',
                            author: issue.user?.login || 'unknown',
                            assignee: assignee || '',
                            body: issue.body || '',
                            github_url: issue.html_url,
                            labels: issue.labels.map((l: any) => typeof l === 'string' ? l : l.name),
                            import: {
                                src: 'github.com',
                                at: importedAt,
                                dit_version: ditVersion,
                                external_id: externalId
                            }
                        };
                        
                        // Also ensure the author exists
                        await syncUser(issue.user);
                        
                        issueDirPath = await saveIssue(issueData, skipAdd);
                        if (verbose) addLog(`Saved issue #${issue.number} to ${issueDirPath}`);
                        externalIndex.set(externalId, { dir: issueDirPath, importAt: Date.parse(importedAt) });
                    } else {
                        if (verbose) addLog(`Issue #${issue.number} already exists, checking for comments...`);
                    }
                    if (issueDirPath) {
                        await updateIssueImport(issueDirPath, externalId, importedAt);
                    }

                    // Import comments
                    if (issue.comments > 0) {
                        const localCommentCount = getCommentCountForIssue(issueDirPath!);
                        if (localCommentCount >= issue.comments) {
                            if (verbose) addLog(`  Issue #${issue.number} already has ${localCommentCount} comments locally. Skipping.`);
                            continue;
                        }

                        const comments = await octokit.paginate(octokit.issues.listComments, {
                            owner,
                            repo,
                            issue_number: issue.number,
                            per_page: 100,
                        });

                        for (const comment of comments) {
                            const commentExternalId = `github:comment:${comment.id}`;
                            if (!findCommentByExternalId(issueDirPath!, commentExternalId)) {
                                await syncUser(comment.user);
                                await saveComment(issueDirPath!, {
                                    id: generateUniqueId(),
                                    external_id: commentExternalId,
                                    author: comment.user?.login || 'unknown',
                                    date: comment.created_at,
                                    body: comment.body || ''
                                }, skipAdd);
                                if (verbose) addLog(`  Added comment ${comment.id}`);
                            }
                        }
                    }
                }

                if (usersOnly && issue.comments > 0) {
                     const comments = await octokit.paginate(octokit.issues.listComments, {
                        owner,
                        repo,
                        issue_number: issue.number,
                        per_page: 100,
                    });
                    for (const comment of comments) {
                        await syncUser(comment.user);
                    }
                }
            }

            addLog('Import completed successfully!');
            setTimeout(() => exit(), 1000);
        } catch (err: any) {
            setError(`Failed to import issues: ${err.message}`);
        }
    };

    useInput((input, key) => {
        if (!isConfirmed && !error && repoUrl) {
            if (key.return) {
                setIsConfirmed(true);
            }
        }
    });

    if (error) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="red">Error: {error}</Text>
                <Text dimColor>Press Ctrl+C to exit</Text>
            </Box>
        );
    }

    if (!isConfirmed && repoUrl) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text bold color="cyan">Import issues from GitHub</Text>
                <Box marginTop={1}>
                    <Text>Repository: </Text>
                    <Text color="yellow">{repoUrl}</Text>
                </Box>
                <Box marginTop={1}>
                    <Text>Scope: </Text>
                    <Text color="green">{all ? 'All issues (open & closed)' : 'Open issues only'}</Text>
                </Box>
                <Box marginTop={1}>
                    <Text>Press </Text>
                    <Text bold color="white">Enter</Text>
                    <Text> to start the import, or </Text>
                    <Text bold color="white">Ctrl+C</Text>
                    <Text> to cancel.</Text>
                </Box>
            </Box>
        );
    }

    if (!repoUrl) {
        return (
            <Box padding={1}>
                <Text>Detecting repository...</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            {verbose && logs.map((log, i) => (
                <Text key={i} dimColor>{log}</Text>
            ))}
            {!verbose && <Text color="yellow">{status}</Text>}
        </Box>
    );
}
