import React, {useState, useEffect} from 'react';
import {Text, Box} from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {execa} from 'execa';

import {getAllIssueDirs} from '../utils/issues.js';
import {loadIssueWorkflow, getClosedStates, getStatusInkColor, formatStatusLabel, normalizeStatus} from '../utils/workflow.js';

type Issue = {
    id: string;
    title: string;
    status: string;
    severity: string;
    assignee: string;
    author: string;
    created: string;
    labels: string[];
    isDirty?: boolean;
    slug: string;
};

export default function IssueList({flags}: {flags: any}) {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [workflow, setWorkflow] = useState(() => loadIssueWorkflow());

    useEffect(() => {
        async function loadIssues() {
            try {
                const workflow = loadIssueWorkflow();
                setWorkflow(workflow);
                const closedStates = new Set(getClosedStates(workflow));
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
                    const issueYamlPath = path.join(issuesDir, dir, 'meta.yaml');
                    const content = fs.readFileSync(issueYamlPath, 'utf8');
                    const meta = yaml.load(content) as any;
                    
                    const status = normalizeStatus(meta.status || 'open', workflow) || 'open';
                    
                    // Filter by status
                    if (!flags.all && closedStates.has(status)) continue;

                    // Filter by label
                    const filterLabelsStr = flags.label;
                    if (filterLabelsStr) {
                        const filterLabels = filterLabelsStr.split(',').map((l: string) => l.trim().toLowerCase());
                        const issueLabels = (meta.labels || []).map((l: string) => l.toLowerCase());
                        if (!filterLabels.every((fl: string) => issueLabels.includes(fl))) {
                            continue;
                        }
                    }

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
                        status,
                        severity: meta.severity || 'medium',
                        assignee: meta.assignee || 'Unassigned',
                        author: author,
                        created: meta.created,
                        labels: meta.labels || [],
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
                <Box width={30}><Text bold underline>Title</Text></Box>
                <Box width={12}><Text bold underline>Status</Text></Box>
                <Box width={12}><Text bold underline>Severity</Text></Box>
                <Box width={15}><Text bold underline>Assignee</Text></Box>
                <Box width={15}><Text bold underline>Labels</Text></Box>
                <Box width={12}><Text bold underline>Created</Text></Box>
                <Box width={3}><Text bold> </Text></Box>
            </Box>
            {issues.map((issue) => (
                <Box key={issue.id}>
                    <Box width={10}><Text color="dim">{issue.id}</Text></Box>
                    <Box width={30}><Text wrap="truncate-end">{issue.title}</Text></Box>
                    <Box width={12}>
                        <Text color={getStatusInkColor(issue.status, workflow)}>
                            {formatStatusLabel(issue.status)}
                        </Text>
                    </Box>
                    <Box width={12}>
                        <Text color={
                            issue.severity === 'critical' ? 'red' : 
                            issue.severity === 'high' ? 'red' : 
                            issue.severity === 'medium' ? 'yellow' : 'blue'
                        }>
                            {issue.severity}
                        </Text>
                    </Box>
                    <Box width={15}><Text color="magenta" wrap="truncate-end">{issue.assignee}</Text></Box>
                    <Box width={15}><Text color="blue" wrap="truncate-end">{issue.labels.join(', ')}</Text></Box>
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
