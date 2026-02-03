import React, {useState, useEffect, useMemo, useRef} from 'react';
import {Text, Box, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {execa} from 'execa';
import {spawnSync} from 'node:child_process';
import FlexSearch from 'flexsearch';
import {watch} from 'chokidar';
import IssueView from './IssueView.js';
import IssueEdit from './IssueEdit.js';
import NewIssue from './NewIssue.js';
import IssueComment from './IssueComment.js';

import {getAllIssueDirs} from '../utils/issues.js';

type Issue = {
    id: string;
    title: string;
    status: string;
    severity: string;
    assignee: string;
    author: string;
    created: string;
    slug: string;
    labels: string[];
    isDirty?: boolean;
};

export default function InteractiveDashboard({flags}: {flags: any}) {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('state:open ');
    const [prevSearchQuery, setPrevSearchQuery] = useState('state:open ');
    const [viewingIssueId, setViewingIssueId] = useState<string | null>(null);
    const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
    const [commentingIssueId, setCommentingIssueId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSearching, setIsSearching] = useState(true);
    const [isSorting, setIsSorting] = useState(false);
    const [sortBy, setSortBy] = useState<'created' | 'title' | 'id' | 'status' | 'severity' | 'assignee'>('created');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [sortSelectedIndex, setSortSelectedIndex] = useState(0);
    const {exit} = useApp();

    const index = useMemo(() => new (FlexSearch as any).Document({
        document: {
            id: "id",
            index: ["content", "assignee", "author"],
        },
        tokenize: "forward",
        resolution: 9,
        cache: true
    }), []);

    const indexIssue = async (slug: string) => {
        const issuesDir = path.join('.dit', 'issues');
        const issueDir = path.join(issuesDir, slug);
        if (!fs.existsSync(issueDir)) return;

        const issueYamlPath = path.join(issueDir, 'issue.yaml');
        if (!fs.existsSync(issueYamlPath)) return;

        try {
            const issueContent = fs.readFileSync(issueYamlPath, 'utf8');
            const meta = yaml.load(issueContent) as any;
            if (!meta || !meta.id) return;

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

            let fullContent = issueContent;
            const files = fs.readdirSync(issueDir);
            for (const file of files) {
                if (file.startsWith('comment-') && file.endsWith('.yaml')) {
                    fullContent += '\n' + fs.readFileSync(path.join(issueDir, file), 'utf8');
                }
            }

            index.remove(meta.id);
            index.add({
                id: meta.id,
                content: fullContent + '\n' + (meta.labels || []).join(' '),
                assignee: meta.assignee || 'Unassigned',
                author: author
            });
        } catch (e) {
            // ignore
        }
    };

    const SORT_OPTIONS: {label: string, field: typeof sortBy}[] = [
        {label: 'Created', field: 'created'},
        {label: 'ID', field: 'id'},
        {label: 'Title', field: 'title'},
        {label: 'Status', field: 'status'},
        {label: 'Severity', field: 'severity'},
        {label: 'Assignee', field: 'assignee'},
    ];

    useEffect(() => {
        loadIssues();
    }, []);

    useEffect(() => {
        const issuesDir = path.join('.dit', 'issues');
        if (!fs.existsSync(issuesDir)) return;

        const watcher = watch(issuesDir, {
            ignoreInitial: true,
            persistent: true
        });

        watcher.on('all', async (event, filePath) => {
            const relative = path.relative(issuesDir, filePath);
            const parts = relative.split(path.sep);
            
            // Find which part of the path is the issue directory
            // We assume issue directory contains issue.yaml
            let currentPath = '';
            let slug = '';
            for (const part of parts) {
                currentPath = path.join(currentPath, part);
                if (fs.existsSync(path.join(issuesDir, currentPath, 'issue.yaml'))) {
                    slug = currentPath;
                    break;
                }
            }

            if (slug) {
                await indexIssue(slug);
                loadIssues();
            }
        });

        return () => {
            watcher.close();
        };
    }, []);

    useEffect(() => {
        const terms = searchQuery.split(/\s+/);
        const filters: Record<string, string[]> = {};
        const textTerms: string[] = [];

        terms.forEach(term => {
            if (term.includes(':')) {
                const [key, value] = term.split(':');
                if (key && value) {
                    const k = key.toLowerCase();
                    if (!filters[k]) filters[k] = [];
                    filters[k].push(value.toLowerCase());
                }
            } else if (term) {
                textTerms.push(term.toLowerCase());
            }
        });

        let result = issues;

        if (textTerms.length > 0) {
            const query = textTerms.join(' ');
            const searchResults = index.search(query, {suggest: true});
            const matchedIds = new Set<string>();
            if (Array.isArray(searchResults)) {
                searchResults.forEach((r: any) => {
                    if (r.result) {
                        r.result.forEach((id: string) => matchedIds.add(id));
                    }
                });
            }
            result = result.filter(issue => matchedIds.has(issue.id));
        }

        result = result.filter(issue => {
            // Check filters
            for (const [key, values] of Object.entries(filters)) {
                if (key === 'state' || key === 'is') {
                    if (!values.some(v => {
                        if (v === 'open') return issue.status === 'open' || issue.status === 'assigned' || issue.status === 'in-progress';
                        return issue.status === v;
                    })) return false;
                } else if (key === 'severity') {
                    if (!values.includes(issue.severity)) return false;
                } else if (key === 'assignee') {
                    if (!values.some(v => issue.assignee.toLowerCase().includes(v))) return false;
                } else if (key === 'author') {
                    if (!values.some(v => issue.author.toLowerCase().includes(v))) return false;
                } else if (key === 'label') {
                    if (!values.every(v => issue.labels.some(l => l.toLowerCase() === v))) return false;
                } else if (key === 'id') {
                    if (!values.includes(issue.id.toLowerCase())) return false;
                }
            }

            return true;
        });

        const severityOrder: Record<string, number> = {critical: 0, high: 1, medium: 2, low: 3};
        const statusOrder: Record<string, number> = {open: 0, assigned: 1, 'in-progress': 2, closed: 3};

        result.sort((a, b) => {
            let valA: any = a[sortBy];
            let valB: any = b[sortBy];

            if (sortBy === 'created') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (sortBy === 'severity') {
                valA = severityOrder[valA] ?? 99;
                valB = severityOrder[valB] ?? 99;
            } else if (sortBy === 'status') {
                valA = statusOrder[valA] ?? 99;
                valB = statusOrder[valB] ?? 99;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        setFilteredIssues(result);
        
        if (searchQuery !== prevSearchQuery) {
            setSelectedIndex(0);
            setPrevSearchQuery(searchQuery);
        } else {
            setSelectedIndex(prev => Math.max(0, Math.min(prev, result.length - 1)));
        }
    }, [searchQuery, issues, prevSearchQuery, sortBy, sortDirection]);

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
                await indexIssue(dir);
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
                    slug: dir,
                    labels: meta.labels || [],
                    isDirty: isDirty
                });
            }

            setIssues(loadedIssues);
            setLoading(false);
        } catch (err) {
            setLoading(false);
        }
    }

    const openEditor = (id: string) => {
        setEditingIssueId(id);
    };

    useInput((input, key) => {
        if (viewingIssueId || editingIssueId || isCreating) {
            return;
        }

        if (isSorting) {
            if (key.upArrow) {
                setSortSelectedIndex(prev => (prev > 0 ? prev - 1 : SORT_OPTIONS.length - 1));
            }
            if (key.downArrow) {
                setSortSelectedIndex(prev => (prev < SORT_OPTIONS.length - 1 ? prev + 1 : 0));
            }
            if (key.return) {
                const selected = SORT_OPTIONS[sortSelectedIndex];
                if (sortBy === selected.field) {
                    setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                    setSortBy(selected.field);
                    setSortDirection(selected.field === 'created' ? 'desc' : 'asc');
                }
                setIsSorting(false);
            }
            if (key.escape) {
                setIsSorting(false);
            }
            return;
        }

        if (key.tab) {
            setIsSearching(prev => !prev);
            return;
        }

        if (key.escape) {
            exit();
            return;
        }

        if (!isSearching) {
            if (key.upArrow) {
                if (selectedIndex === 0) {
                    setIsSearching(true);
                } else {
                    setSelectedIndex(prev => prev - 1);
                }
            }
            if (key.downArrow) {
                if (selectedIndex === filteredIssues.length - 1) {
                    setIsSearching(true);
                } else {
                    setSelectedIndex(prev => prev + 1);
                }
            }
            if (key.return) {
                if (filteredIssues[selectedIndex]) {
                    setViewingIssueId(filteredIssues[selectedIndex].id);
                }
            }
            if (input === 's') {
                setIsSorting(true);
            }
            if (input === 'e') {
                const issue = filteredIssues[selectedIndex];
                if (issue) {
                    openEditor(issue.id);
                }
            }
            if (input === 'c') {
                const issue = filteredIssues[selectedIndex];
                if (issue) {
                    setCommentingIssueId(issue.id);
                }
            }
            if (input === 'n') {
                setIsCreating(true);
            }
            if (input === 'd') {
                const issue = filteredIssues[selectedIndex];
                if (issue && issue.isDirty) {
                    const issuePath = path.join('.dit', 'issues', issue.slug);
                    spawnSync('sh', ['-c', `git diff HEAD --color=always "${issuePath}" | less -R`], {stdio: 'inherit'});
                }
            }
        } else {
            if (key.return || key.downArrow) {
                setIsSearching(false);
                setSelectedIndex(0);
            }
            if (key.upArrow) {
                setIsSearching(false);
                setSelectedIndex(filteredIssues.length - 1);
            }
        }
    });

    if (viewingIssueId) {
        return <IssueView id={viewingIssueId} onBack={() => {
            setViewingIssueId(null);
            loadIssues();
        }} />;
    }

    if (editingIssueId) {
        return <IssueEdit id={editingIssueId} onBack={() => {
            setEditingIssueId(null);
            loadIssues();
        }} />;
    }

    if (commentingIssueId) {
        return <IssueComment id={commentingIssueId} onBack={() => {
            setCommentingIssueId(null);
            loadIssues();
        }} />;
    }

    if (isCreating) {
        return <NewIssue onBack={() => {
            setIsCreating(false);
            loadIssues();
        }} />;
    }

    if (loading) return <Text>Loading dashboard...</Text>;

    return (
        <Box flexDirection="column" padding={1}>
            <Box borderStyle="single" borderColor={isSearching ? 'blue' : 'dim'} paddingX={1} marginBottom={1} flexDirection="column">
                <Text bold color={isSearching ? 'blue' : undefined}>Distributed Issue Tracker</Text>
                <Box>
                    <Text color={isSearching ? 'white' : 'dim'}>Search: </Text>
                    <TextInput 
                        value={searchQuery} 
                        onChange={setSearchQuery} 
                        focus={isSearching}
                    />
                </Box>
            </Box>

            {isSorting && (
                <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginY={1}>
                    <Text bold color="cyan">Sort Issues By:</Text>
                    {SORT_OPTIONS.map((opt, idx) => (
                        <Text key={opt.field} color={idx === sortSelectedIndex ? 'yellow' : undefined}>
                            {idx === sortSelectedIndex ? '❯ ' : '  '}
                            {opt.label}
                            {sortBy === opt.field ? ` (${sortDirection})` : ''}
                        </Text>
                    ))}
                    <Box marginTop={1}>
                        <Text dimColor>↑/↓: Navigate | Enter: Select | Esc: Cancel</Text>
                    </Box>
                </Box>
            )}

            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Box width={10}><Text bold underline>ID{sortBy === 'id' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</Text></Box>
                    <Box width={30}><Text bold underline>Title{sortBy === 'title' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</Text></Box>
                    <Box width={12}><Text bold underline>Status{sortBy === 'status' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</Text></Box>
                    <Box width={12}><Text bold underline>Severity{sortBy === 'severity' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</Text></Box>
                    <Box width={15}><Text bold underline>Assignee{sortBy === 'assignee' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</Text></Box>
                    <Box width={15}><Text bold underline>Labels</Text></Box>
                    <Box width={12}><Text bold underline>Created{sortBy === 'created' ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</Text></Box>
                    <Box width={3}><Text bold> </Text></Box>
                </Box>
                {filteredIssues.map((issue, index) => (
                    <Box key={issue.id}>
                        <Box width={10}>
                            <Text color={!isSearching && index === selectedIndex ? 'blue' : 'dim'}>
                                {!isSearching && index === selectedIndex ? '❯ ' : '  '}{issue.id}
                            </Text>
                        </Box>
                        <Box width={30}>
                            <Text wrap="truncate-end" bold={!isSearching && index === selectedIndex}>
                                {issue.title}
                            </Text>
                        </Box>
                        <Box width={12}>
                            <Text color={
                                issue.status === 'open' ? 'green' : 
                                issue.status === 'assigned' ? 'blue' :
                                issue.status === 'in-progress' ? 'yellow' : 'gray'
                            }>
                                {issue.status}
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
            </Box>

            <Box marginTop={1}>
                <Text dimColor>
                    {isSearching 
                        ? "Type to search | Enter/Tab: Select list | Esc: Exit" 
                        : "↑/↓: Navigate | Enter: View | s: Sort | e: Edit | c: Comment | n: New | d: Diff | Tab: Search | Esc: Exit"}
                </Text>
            </Box>
        </Box>
    );
}
