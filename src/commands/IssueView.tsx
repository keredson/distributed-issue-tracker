import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {Text, Box, useApp, useInput, useStdout} from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {marked} from 'marked';
import TerminalRenderer from 'marked-terminal';
import {execa} from 'execa';
import {spawnSync} from 'node:child_process';
import wrapAnsi from 'wrap-ansi';
import IssueEdit from './IssueEdit.js';
import IssueComment from './IssueComment.js';
import {threadComments, Comment} from '../utils/comments.js';
import {findIssueDirById} from '../utils/issues.js';

// Configure marked to use terminal renderer
marked.setOptions({
    renderer: new TerminalRenderer() as any
});

type Props = {
    id?: string;
    onBack?: () => void;
};

export default function IssueView({id, onBack}: Props) {
    const [meta, setMeta] = useState<any>(null);
    const [content, setContent] = useState<string>('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [author, setAuthor] = useState<string>('Unknown');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [issuePath, setIssuePath] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [focusIndex, setFocusIndex] = useState(-1); // -1 is body, 0+ are comments
    const [isDirty, setIsDirty] = useState(false);
    const [scrollTop, setScrollTop] = useState(0);
    const {exit} = useApp();
    const {stdout} = useStdout();

    const threadedComments = useMemo(() => {
        return threadComments(comments);
    }, [comments]);

    const loadIssue = useCallback(async () => {
        if (!id) {
            setError('No issue ID provided');
            setLoading(false);
            return;
        }

        const issuesDir = path.join('.dit', 'issues');
        const issueDirName = findIssueDirById(issuesDir, id);

        if (!issueDirName) {
            setError(`Issue with ID ${id} not found`);
            setLoading(false);
            return;
        }

        const fullPath = path.join(issuesDir, issueDirName);
        setIssuePath(fullPath);
        const issueYamlPath = path.join(fullPath, 'issue.yaml');
        try {
            const yamlContent = fs.readFileSync(issueYamlPath, 'utf8');
            const data = yaml.load(yamlContent) as any;
            setMeta(data);
            setContent(data.body || '');

            // Load comments
            const getAllFilesRecursive = (dir: string): string[] => {
                let results: string[] = [];
                const list = fs.readdirSync(dir);
                list.forEach(file => {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);
                    if (stat && stat.isDirectory()) {
                        results = results.concat(getAllFilesRecursive(fullPath));
                    } else {
                        results.push(fullPath);
                    }
                });
                return results;
            };

            const allFiles = getAllFilesRecursive(fullPath);
            const commentFiles = allFiles.filter(f => {
                const base = path.basename(f);
                return f.endsWith('.yaml') && (base.startsWith('comment-') || f.includes(`${path.sep}comments${path.sep}`));
            });
            
            // Get dirty status for all files in the issue directory at once
            const {stdout: gitStatus} = await execa('git', ['status', '--porcelain', fullPath]);
            const dirtyFiles = new Set(
                gitStatus.split('\n')
                    .map(line => line.slice(3).trim())
                    .map(p => path.resolve(p))
            );

            const loadedComments = commentFiles.map(f => {
                const commentContent = fs.readFileSync(f, 'utf8');
                const commentData = yaml.load(commentContent) as any;
                return {
                    ...commentData,
                    date: commentData.date || commentData.created,
                    isDirty: dirtyFiles.has(path.resolve(f))
                };
            });
            // Sort comments by date
            loadedComments.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setComments(loadedComments);

            // Derive author from meta or git
            if (data.author) {
                setAuthor(data.author);
            } else {
                try {
                    const {stdout} = await execa('git', [
                        'log', '--diff-filter=A', '--format=%an', '-n', '1', '--', issueYamlPath
                    ]);
                    setAuthor(stdout.trim() || 'Local');
                } catch (e) {
                    setAuthor('Local');
                }
            }

            // Check if dirty
            try {
                const {stdout} = await execa('git', ['status', '--porcelain', fullPath]);
                setIsDirty(stdout.trim().length > 0);
            } catch (e) {
                setIsDirty(false);
            }

        } catch (err: any) {
            setError(`Error reading issue: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        // Clear screen and home cursor to ensure stable initial render
        process.stdout.write('\x1b[2J\x1b[0;0H');
        loadIssue();
    }, [loadIssue]);

    const rows = stdout?.rows || 24;
    const cols = stdout?.columns || 80;
    
    // Stable height for the content area
    // Header (3) + Title (2) + Footer (2) + Padding (2) + Margin (1) = 10
    const availableHeight = Math.max(1, rows - 10);

    const renderedLines = useMemo(() => {
        let lines: {text: string, isFocused: boolean}[] = [];
        const basePadding = 2;
        
        const wrapAndPush = (text: string, isFocused: boolean, indent = 0) => {
            // Subtract 8 for margin/padding + basePadding
            const wrapped = wrapAnsi(text, cols - 8 - indent - basePadding, {hard: true}).trim();
            if (!wrapped) return;
            wrapped.split('\n').forEach((line) => {
                lines.push({
                    text: ' '.repeat(basePadding + indent) + line,
                    isFocused
                });
            });
        };

        // Body content
        if (content) {
            const bodyAnsi = (marked.parse(content.trim()) as string).trim();
            wrapAndPush(bodyAnsi, focusIndex === -1);
        }

        if (threadedComments.length > 0) {
            lines.push({text: '', isFocused: false});
            const labelText = ' Comments ';
            const countText = `(${comments.length})`;
            const lineLength = cols - 10;
            const headerLine = `\x1b[36m──\x1b[39m\x1b[2m${labelText}\x1b[22m${countText}\x1b[36m ${'─'.repeat(Math.max(0, lineLength - labelText.length - countText.length - 3))}\x1b[39m`;
            lines.push({text: headerLine, isFocused: false});

            threadedComments.forEach((comment, index) => {
                const isFocused = focusIndex === index;
                const dateStr = new Date(comment.date).toLocaleString();
                const dirtyIndicator = comment.isDirty ? ' \x1b[33m\x1b[1m●\x1b[22m\x1b[39m' : '';
                const baseIndent = comment.depth * 4;
                
                let headerPrefix = '';
                if (comment.depth > 0) {
                    headerPrefix = '└─ ';
                }
                
                const header = `\x1b[1m${comment.author}\x1b[22m \x1b[2m(${dateStr})\x1b[22m${dirtyIndicator}`;
                
                // Header line with basePadding
                lines.push({
                    text: ' '.repeat(basePadding + Math.max(0, baseIndent - headerPrefix.length)) + headerPrefix + header,
                    isFocused
                });
                
                const commentAnsi = (marked.parse(comment.body.trim()) as string).trim();
                wrapAndPush(commentAnsi, isFocused, baseIndent);
                
                if (index < threadedComments.length - 1 && threadedComments[index + 1].depth === 0) {
                    lines.push({text: '\x1b[2m' + '┈'.repeat(cols - 10) + '\x1b[22m', isFocused: false});
                }
            });
        }

        return lines;
    }, [content, threadedComments, cols, focusIndex]);

    const maxScroll = Math.max(0, renderedLines.length - availableHeight);

    useInput((input, key) => {
        if (isEditing || isCommenting) return;

        if (input === 'b' || key.escape) {
            if (onBack) {
                onBack();
            } else {
                exit();
            }
        }

        if (input === 'e' && issuePath) {
            setIsEditing(true);
        }

        if (input === 'r' && issuePath) {
            if (focusIndex === -1) {
                setReplyingToId(null);
            } else {
                setReplyingToId(threadedComments[focusIndex].id);
            }
            setIsCommenting(true);
        }

        if (key.tab) {
            if (key.shift) {
                setFocusIndex(prev => Math.max(-1, prev - 1));
            } else {
                setFocusIndex(prev => Math.min(threadedComments.length - 1, prev + 1));
            }
        }

        if (input === 'd' && issuePath && isDirty) {
            spawnSync('sh', ['-c', `git diff HEAD --color=always "${issuePath}" | less -R`], {stdio: 'inherit'});
        }

        if (key.upArrow || input === 'k') {
            if (focusIndex > -1) {
                setFocusIndex(prev => prev - 1);
            } else {
                setScrollTop(prev => Math.max(0, prev - 1));
            }
        }
        if (key.downArrow || input === 'j' || input === ' ') {
            if (focusIndex < threadedComments.length - 1) {
                setFocusIndex(prev => prev + 1);
            } else {
                setScrollTop(prev => Math.min(maxScroll, prev + 1));
            }
        }

        if (key.pageUp) {
            setScrollTop(prev => Math.max(0, prev - (availableHeight - 2)));
        }
        if (key.pageDown) {
            setScrollTop(prev => Math.min(maxScroll, prev + (availableHeight - 2)));
        }
        if (input === 'g') {
            setScrollTop(0);
            setFocusIndex(-1);
        }
        if (input === 'G') {
            setScrollTop(maxScroll);
            setFocusIndex(threadedComments.length - 1);
        }
    });

    useEffect(() => {
        // Scroll to focused element if it's off screen
        const firstLineIndex = renderedLines.findIndex(l => l.isFocused);
        if (firstLineIndex !== -1) {
            if (firstLineIndex < scrollTop) {
                setScrollTop(firstLineIndex);
            } else if (firstLineIndex >= scrollTop + availableHeight) {
                setScrollTop(Math.min(maxScroll, firstLineIndex - Math.floor(availableHeight / 2)));
            }
        }
    }, [focusIndex, renderedLines, scrollTop, availableHeight, maxScroll]);

    if (loading) return (
        <Box height={rows} alignItems="center" justifyContent="center">
            <Text>Loading issue...</Text>
        </Box>
    );

    if (error) return (
        <Box flexDirection="column" height={rows} padding={1}>
            <Text color="red">Error: {error}</Text>
            {onBack && <Text dimColor>Press any key to go back</Text>}
        </Box>
    );

    if (isEditing && id) {
        return <IssueEdit id={id} onBack={() => {
            setIsEditing(false);
            loadIssue();
        }} />;
    }

    if (isCommenting && id) {
        const parentContent = focusIndex === -1 ? content : threadedComments[focusIndex].body;
        return <IssueComment id={id} replyTo={replyingToId || undefined} parentContent={parentContent} onBack={() => {
            setIsCommenting(false);
            loadIssue();
        }} />;
    }

    const visibleLines = renderedLines.slice(scrollTop, scrollTop + availableHeight);

    const displayLines = [...visibleLines];
    while (displayLines.length < availableHeight) {
        displayLines.push({text: '', isFocused: false});
    }

    const scrollPercent = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const thumbPosition = Math.floor(scrollPercent * (availableHeight - 1));

    return (
        <Box flexDirection="column" height={rows} padding={1}>
            <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="row" flexShrink={0}>
                <Box marginRight={2}>
                    <Text color="dim">ID: </Text>
                    <Text>{meta.id}</Text>
                </Box>
                <Box marginRight={2}>
                    <Text color="dim">Status: </Text>
                    <Text color={
                        meta.status === 'open' ? 'green' : 
                        meta.status === 'assigned' ? 'blue' :
                        meta.status === 'in-progress' ? 'yellow' : 'gray'
                    }>{meta.status}</Text>
                </Box>
                <Box marginRight={2}>
                    <Text color="dim">Severity: </Text>
                    <Text color={
                        (meta.severity || 'medium') === 'critical' ? 'red' : 
                        (meta.severity || 'medium') === 'high' ? 'red' : 
                        (meta.severity || 'medium') === 'medium' ? 'yellow' : 'blue'
                    }>
                        {meta.severity || 'medium'}
                    </Text>
                </Box>
                <Box marginRight={2}>
                    <Text color="dim">Author: </Text>
                    <Text color="cyan">{author}</Text>
                </Box>
                <Box marginRight={2}>
                    <Text color="dim">Assignee: </Text>
                    <Text color="magenta">{meta.assignee || 'Unassigned'}</Text>
                </Box>
                <Box flexGrow={1}>
                    <Text color="dim">Created: </Text>
                    <Text>{new Date(meta.created).toLocaleString()}</Text>
                </Box>
                {isDirty && (
                    <Box marginLeft={2}>
                        <Text color="yellow" bold>●</Text>
                    </Box>
                )}
            </Box>
            
            <Box marginTop={1} paddingX={1} flexDirection="column" flexGrow={1}>
                <Box flexShrink={0} marginBottom={1}>
                    <Text bold underline color={focusIndex === -1 ? 'yellow' : 'white'} wrap="truncate-end">
                        {meta.title}
                    </Text>
                </Box>
                
                <Box flexDirection="row" height={availableHeight}>
                    <Box flexDirection="column" flexGrow={1}>
                        {displayLines.map((line, i) => (
                            <Box key={i} flexDirection="row">
                                <Box flexGrow={1}>
                                    <Text color={line.isFocused ? 'yellow' : undefined} bold={line.isFocused} wrap="truncate-end">
                                        {line.text || ' '}
                                    </Text>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                    
                    {renderedLines.length > availableHeight && (
                        <Box flexDirection="column" marginLeft={1} width={1}>
                            {Array.from({length: availableHeight}).map((_, i) => (
                                <Text key={i} color={i === thumbPosition ? 'white' : 'gray'}>
                                    {i === thumbPosition ? '█' : '│'}
                                </Text>
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>

            <Box marginTop={1} flexShrink={0} paddingX={1} flexDirection="row">
                <Box flexShrink={0}>
                    <Text dimColor>
                        {onBack ? 'b: Back' : 'Esc: Exit'}
                        {' | e: Edit | r: Reply'}
                        {isDirty && ' | d: Diff'}
                    </Text>
                </Box>
                <Box flexGrow={1} />
                <Box flexShrink={0}>
                    <Text dimColor>
                        Line {scrollTop + 1}/{renderedLines.length} (↑/↓, j/k, Tab, PgUp/Dn, g/G)
                    </Text>
                </Box>
            </Box>
        </Box>
    );
}
