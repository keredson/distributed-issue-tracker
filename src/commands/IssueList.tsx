import React, {useState, useEffect} from 'react';
import {Text, Box} from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {execa} from 'execa';

import {getAllIssueDirs} from '../utils/issues.js';

type Issue = {
    id: string;
    title: string;
    status: string;
    severity: string;
    assignee: string;
    author: string;
    created: string;
    isDirty?: boolean;
    slug: string;
};

export default function IssueList({flags}: {flags: any}) {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadIssues() {
            try {
                const issuesDir = path.join('.dit', 'issues');
                if (!fs.existsSync(issuesDir)) {
                    setIssues([]);
                    setLoading(false);
                    return;
                }

                const {stdout: gitStatus} = await execa('git', ['status', '--porcelain', issuesDir]);
                const dirtyPaths = new Set<string>();
                gitStatus.split('\n').forEach(line => {
                    if (!line) return;
                    const filePath = line.slice(3).trim();
                    dirtyPaths.add(filePath);
                });

                const dirs = getAllIssueDirs(issuesDir);
                const loadedIssues: Issue[] = [];

                for (const dir of dirs) {
                    const issueYamlPath = path.join(issuesDir, dir, 'issue.yaml');
                    const content = fs.readFileSync(issueYamlPath, 'utf8');
                    const meta = yaml.load(content) as any;
                    
                    let author = meta.author;
                    if (!author) {
                        try {
                            const {stdout} = await execa('git', [
                                'log', '--diff-filter=A', '--format=%an', '-n', '1', '--', issueYamlPath
                            ]);
                            author = stdout.trim() || 'Local';
                        } catch (e) {
                            author = 'Local';
                        }
                    }

                    let isDirty = false;
                    for (const dirtyPath of dirtyPaths) {
                        if (dirtyPath.startsWith(path.join(issuesDir, dir))) {
                            isDirty = true;
                            break;
                        }
                    }

                    loadedIssues.push({
                        id: meta.id,
                        title: meta.title,
                        status: meta.status || 'open',
                        severity: meta.severity || 'medium',
                        assignee: meta.assignee || 'Unassigned',
                        author: author,
                        created: meta.created,
                        isDirty: isDirty,
                        slug: dir
                    });
                }

                // Sort by created date descending
                loadedIssues.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
                
                setIssues(loadedIssues);
                setLoading(false);
            } catch (err: any) {
                setError(err.message);
                setLoading(false);
            }
        }

        loadIssues();
    }, []);

    if (loading) {
        return <Text>Loading issues...</Text>;
    }

    if (error) {
        return <Text color="red">Error: {error}</Text>;
    }

    if (issues.length === 0) {
        return <Text color="yellow">No issues found.</Text>;
    }

    return (
        <Box flexDirection="column" paddingY={1}>
            <Box marginBottom={1}>
                <Box width={10}><Text bold underline>ID</Text></Box>
                <Box width={35}><Text bold underline>Title</Text></Box>
                <Box width={12}><Text bold underline>Status</Text></Box>
                <Box width={12}><Text bold underline>Severity</Text></Box>
                <Box width={20}><Text bold underline>Assignee</Text></Box>
                <Box width={12}><Text bold underline>Created</Text></Box>
                <Box width={3}><Text bold> </Text></Box>
            </Box>
            {issues.map((issue) => (
                <Box key={issue.id}>
                    <Box width={10}><Text color="dim">{issue.id}</Text></Box>
                    <Box width={35}><Text wrap="truncate-end">{issue.title}</Text></Box>
                                            <Box width={12}>
                                                <Text color={
                                                    issue.status === 'open' ? 'green' : 
                                                    issue.status === 'assigned' ? 'blue' :
                                                    issue.status === 'in-progress' ? 'yellow' : 'gray'
                                                }>
                                                    {issue.status}
                                                </Text>
                                            </Box>                    <Box width={12}>
                        <Text color={
                            issue.severity === 'critical' ? 'red' : 
                            issue.severity === 'high' ? 'red' : 
                            issue.severity === 'medium' ? 'yellow' : 'blue'
                        }>
                            {issue.severity}
                        </Text>
                    </Box>
                    <Box width={20}><Text color="magenta" wrap="truncate-end">{issue.assignee}</Text></Box>
                    <Box width={12}><Text color="dim">{new Date(issue.created).toLocaleDateString()}</Text></Box>
                    <Box width={3}>
                        <Text color="yellow" bold>
                            {issue.isDirty ? '●' : ' '}
                        </Text>
                    </Box>
                </Box>
            ))}
            <Box marginTop={1}>
                <Text dimColor>{issues.length} issue(s) found.</Text>
            </Box>
        </Box>
    );
}
