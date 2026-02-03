import React, {useState, useEffect} from 'react';
import {Text, Box, useApp} from 'ink';
import TextInput from 'ink-text-input';
import {Octokit} from '@octokit/rest';
import {generateUniqueId} from '../utils/id.js';
import {saveIssue, saveComment, findIssueByExternalId, findCommentByExternalId} from '../utils/issues.js';

type Props = {
    url?: string;
    skipAdd?: boolean;
};

export default function Import({url: initialUrl, skipAdd}: Props) {
    const [url, setUrl] = useState(initialUrl || '');
    const [isSubmitted, setIsSubmitted] = useState(!!initialUrl);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const {exit} = useApp();

    useEffect(() => {
        if (isSubmitted && url) {
            importGitHubIssues(url);
        }
    }, [isSubmitted]);

    const parseGitHubUrl = (githubUrl: string) => {
        try {
            const urlObj = new URL(githubUrl);
            if (urlObj.hostname !== 'github.com') return null;
            const parts = urlObj.pathname.split('/').filter(Boolean);
            if (parts.length < 2) return null;
            return {owner: parts[0], repo: parts[1]};
        } catch (e) {
            return null;
        }
    };

    const importGitHubIssues = async (githubUrl: string) => {
        const repoInfo = parseGitHubUrl(githubUrl);
        if (!repoInfo) {
            setError('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
            return;
        }

        const octokit = new Octokit();
        const {owner, repo} = repoInfo;

        try {
            setStatus(`Fetching issues from ${owner}/${repo}...`);
            const issues = await octokit.paginate(octokit.issues.listForRepo, {
                owner,
                repo,
                state: 'all',
                per_page: 100,
            });

            setStatus(`Found ${issues.length} issues/PRs. Importing...`);

            for (const issue of issues) {
                // Skip PRs if they are returned (GitHub API returns PRs in issues list)
                if (issue.pull_request) continue;

                const externalId = `github:${owner}/${repo}#${issue.number}`;
                setStatus(`Processing issue #${issue.number}: ${issue.title}...`);

                let issueDirPath = findIssueByExternalId(externalId);
                
                if (!issueDirPath) {
                    const issueData = {
                        id: generateUniqueId(),
                        external_id: externalId,
                        title: issue.title,
                        created: issue.created_at,
                        status: issue.state === 'closed' ? 'closed' : 'open',
                        severity: 'medium',
                        assignee: issue.assignee?.login || '',
                        body: issue.body || '',
                        github_url: issue.html_url
                    };
                    issueDirPath = await saveIssue(issueData, skipAdd);
                }

                // Import comments
                if (issue.comments > 0) {
                    const comments = await octokit.paginate(octokit.issues.listComments, {
                        owner,
                        repo,
                        issue_number: issue.number,
                        per_page: 100,
                    });

                    for (const comment of comments) {
                        const commentExternalId = `github:comment:${comment.id}`;
                        if (!findCommentByExternalId(issueDirPath, commentExternalId)) {
                            await saveComment(issueDirPath, {
                                id: generateUniqueId(),
                                external_id: commentExternalId,
                                author: comment.user?.login || 'unknown',
                                date: comment.created_at,
                                body: comment.body || ''
                            }, skipAdd);
                        }
                    }
                }
            }

            setStatus('Import completed successfully!');
            setTimeout(() => exit(), 1000);
        } catch (err: any) {
            setError(`Failed to import issues: ${err.message}`);
        }
    };

    if (error) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="red">Error: {error}</Text>
                <Text dimColor>Press Ctrl+C to exit</Text>
            </Box>
        );
    }

    if (!isSubmitted) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text bold color="cyan">Import issues from GitHub</Text>
                <Box marginTop={1}>
                    <Text>GitHub Repository URL: </Text>
                    <TextInput
                        value={url}
                        onChange={setUrl}
                        onSubmit={() => setIsSubmitted(true)}
                    />
                </Box>
                <Box marginTop={1}>
                    <Text dimColor>Example: https://github.com/facebook/react</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            <Text color="yellow">{status}</Text>
        </Box>
    );
}
