import React, {useState, useEffect} from 'react';
import {Text, Box, useApp, useInput} from 'ink';
import {Octokit} from '@octokit/rest';
import {execa} from 'execa';
import {generateUniqueId} from '../utils/id.js';
import {saveIssue, saveComment, findIssueByExternalId, findCommentByExternalId, getCommentCountForIssue} from '../utils/issues.js';
import {createUser, getLocalUsers} from '../utils/user.js';

type Props = {
    url?: string;
    skipAdd?: boolean;
    verbose?: boolean;
    all?: boolean;
};

export default function Import({url: initialUrl, skipAdd, verbose, all}: Props) {
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

    const ensureUserExists = async (githubUser: any) => {
        if (!githubUser) return null;
        const localUsers = await getLocalUsers();
        const username = githubUser.login;
        const exists = localUsers.find(u => u.username === username);
        
        if (!exists) {
            if (verbose) addLog(`Creating local user profile for ${username}...`);
            // We don't have their email, but we can create a profile with a placeholder or just their login
            await createUser(username, {
                name: githubUser.name || githubUser.login,
                email: `${githubUser.login}@users.noreply.github.com`
            });
        }
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

            addLog(`Found ${issues.length} issues/PRs. Importing...`);

            for (const issue of issues) {
                // Skip PRs if they are returned (GitHub API returns PRs in issues list)
                if (issue.pull_request) {
                    if (verbose) addLog(`Skipping PR #${issue.number}`);
                    continue;
                }

                const externalId = `github:${owner}/${repo}#${issue.number}`;
                
                let issueDirPath = findIssueByExternalId(externalId);
                
                if (!issueDirPath) {
                    addLog(`Processing issue #${issue.number}: ${issue.title}...`);
                    const assignee = await ensureUserExists(issue.assignee);
                    
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
                        github_url: issue.html_url
                    };
                    
                    // Also ensure the author exists
                    await ensureUserExists(issue.user);
                    
                    issueDirPath = await saveIssue(issueData, skipAdd);
                    if (verbose) addLog(`Saved issue #${issue.number} to ${issueDirPath}`);
                } else {
                    if (verbose) addLog(`Issue #${issue.number} already exists, checking for comments...`);
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
                            await ensureUserExists(comment.user);
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
