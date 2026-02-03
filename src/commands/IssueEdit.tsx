import React, {useState, useEffect} from 'react';
import {Text, Box, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import {spawnSync} from 'node:child_process';
import {execa} from 'execa';
import {findIssueDirById} from '../utils/issues.js';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {getLocalUsers, LocalUser, getCurrentLocalUser} from '../utils/user.js';

type Props = {
    id: string;
    issuePath?: string;
    onBack: () => void;
    onSave?: (meta: any) => void;
    saveLabel?: string;
    showRevert?: boolean;
};

const STATUSES = ['open', 'assigned', 'in-progress', 'closed'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

export default function IssueEdit({id, issuePath: providedPath, onBack, onSave, saveLabel = 'Save Changes', showRevert = true}: Props) {
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [issuePath, setIssuePath] = useState<string | null>(providedPath || null);
    const [tempMarkdownPath, setTempMarkdownPath] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mode, setMode] = useState<'menu' | 'edit-title' | 'edit-assignee' | 'select-status' | 'select-severity' | 'confirm-revert'>('menu');
    const [tempTitle, setTempTitle] = useState('');
    const [tempAssignee, setTempAssignee] = useState('');
    const [tempStatusIndex, setTempStatusIndex] = useState(0);
    const [tempSeverityIndex, setTempSeverityIndex] = useState(0);
    const [localUsers, setLocalUsers] = useState<LocalUser[]>([]);
    const [assigneeSuggestions, setAssigneeSuggestions] = useState<LocalUser[]>([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const {exit} = useApp();

    useEffect(() => {
        getLocalUsers().then(setLocalUsers);
    }, []);

    useEffect(() => {
        if (mode === 'edit-assignee') {
            const lowerInput = tempAssignee.toLowerCase();
            const filtered = localUsers.filter(user => 
                user.username.toLowerCase().includes(lowerInput) || 
                user.name.toLowerCase().includes(lowerInput)
            );
            setAssigneeSuggestions(filtered);
            setSelectedSuggestionIndex(0);
        }
    }, [tempAssignee, mode, localUsers]);

    const checkDirty = async (pathToCheck: string) => {
        try {
            const {stdout} = await execa('git', ['status', '--porcelain', pathToCheck]);
            setIsDirty(stdout.trim().length > 0);
        } catch (e) {
            setIsDirty(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            let fullPath = providedPath;
            if (!fullPath) {
                const issuesDir = path.join('.dit', 'issues');
                const issueDirName = findIssueDirById(issuesDir, id);

                if (!issueDirName) {
                    setError(`Issue with ID ${id} not found`);
                    setLoading(false);
                    return;
                }

                fullPath = path.join(issuesDir, issueDirName);
            }
            
            setIssuePath(fullPath);
            checkDirty(fullPath);
            const issueYamlPath = path.join(fullPath, 'issue.yaml');
            try {
                if (fs.existsSync(issueYamlPath)) {
                    const yamlContent = fs.readFileSync(issueYamlPath, 'utf8');
                    const loadedData = yaml.load(yamlContent) as any;
                    setMeta(loadedData);
                    setTempTitle(loadedData.title || '');
                    setTempAssignee(loadedData.assignee || '');
                    setTempStatusIndex(STATUSES.indexOf(loadedData.status || 'open'));
                    setTempSeverityIndex(SEVERITIES.indexOf(loadedData.severity || 'medium'));
                } else {
                    // Initialize meta if file doesn't exist (for new issues)
                    const currentUser = await getCurrentLocalUser();
                    const newMeta = {
                        id,
                        title: 'New Issue',
                        created: new Date().toISOString(),
                        status: 'open',
                        severity: 'medium',
                        assignee: '',
                        author: currentUser?.username || '',
                        body: ''
                    };
                    setMeta(newMeta);
                    setTempTitle(newMeta.title);
                    setTempAssignee('');
                    setTempStatusIndex(0);
                    setTempSeverityIndex(1);
                }
            } catch (err: any) {
                setError(`Error reading issue: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [id, providedPath]);

    const handleSave = () => {
        if (!issuePath || !meta) return;
        try {
            let updatedMeta = {...meta};
            if (tempMarkdownPath && fs.existsSync(tempMarkdownPath)) {
                const rawContent = fs.readFileSync(tempMarkdownPath, 'utf8');
                const content = rawContent.split('<!-- DIT: Everything below this line is ignored. Leave your content above. -->')[0].trim();
                updatedMeta.body = content.trim() + '\n';
            }

            if (onSave) {
                onSave(updatedMeta);
            } else {
                const issueYamlPath = path.join(issuePath, 'issue.yaml');
                fs.writeFileSync(issueYamlPath, yaml.dump(updatedMeta, {lineWidth: -1, styles: {'!!str': 'literal'}}));
                onBack();
            }
        } catch (err: any) {
            setError(`Error saving changes: ${err.message}`);
        }
    };

    const openDescriptionEditor = () => {
        if (!issuePath) return;
        
        let currentTempPath = tempMarkdownPath;
        if (!currentTempPath) {
            const dirName = path.basename(issuePath);
            const slug = dirName.replace(`-${id}`, '');
            currentTempPath = path.join(os.tmpdir(), `dit-${slug}-${id}-${Date.now()}.md`);
            try {
                let content = meta.body || '';
                
                const instructions = `

<!-- DIT: Everything below this line is ignored. Leave your content above. -->
# Please enter the description for your issue (Markdown formatted). 
# Issue: ${id}
`;
                fs.writeFileSync(currentTempPath, content + instructions);
                setTempMarkdownPath(currentTempPath);
            } catch (err: any) {
                setError(`Failed to create temp file: ${err.message}`);
                return;
            }
        }

        const editor = process.env.EDITOR || 'vi';
        spawnSync(editor, [currentTempPath], {stdio: 'inherit'});
    };

    useInput((input, key) => {
        if (mode === 'menu') {
            if (key.escape) {
                onBack();
            }
            if (key.upArrow) {
                setSelectedIndex(prev => Math.max(0, prev - 1));
            }
            if (key.downArrow) {
                setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1));
            }
            if (key.return) {
                const selectedItem = menuItems[selectedIndex];
                if (selectedIndex === 0) setMode('edit-title');
                if (selectedIndex === 1) {
                    setTempStatusIndex(STATUSES.indexOf(meta.status || 'open'));
                    setMode('select-status');
                }
                if (selectedIndex === 2) {
                    setTempSeverityIndex(SEVERITIES.indexOf(meta.severity || 'medium'));
                    setMode('select-severity');
                }
                if (selectedIndex === 3) setMode('edit-assignee');
                if (selectedIndex === 4) openDescriptionEditor();
                // 5 is separator
                if (selectedItem.label === saveLabel) handleSave();
                if (selectedItem.label === 'Revert Changes') setMode('confirm-revert');
                if (selectedItem.label === 'Cancel') onBack();
            }
        } else if (mode === 'edit-title') {
            if (key.escape) {
                setTempTitle(meta.title);
                setMode('menu');
            }
        } else if (mode === 'edit-assignee') {
            if (key.escape) {
                setTempAssignee(meta.assignee || '');
                setMode('menu');
            }
            if (assigneeSuggestions.length > 0) {
                if (key.upArrow) {
                    setSelectedSuggestionIndex(prev => Math.max(0, prev - 1));
                }
                if (key.downArrow) {
                    setSelectedSuggestionIndex(prev => Math.min(assigneeSuggestions.length - 1, prev + 1));
                }
                if (key.tab || (key.rightArrow && assigneeSuggestions.length > 0)) {
                    setTempAssignee(assigneeSuggestions[selectedSuggestionIndex].username);
                }
            }
        } else if (mode === 'select-status') {
            if (key.escape) setMode('menu');
            if (key.upArrow) setTempStatusIndex(prev => Math.max(0, prev - 1));
            if (key.downArrow) setTempStatusIndex(prev => Math.min(STATUSES.length - 1, prev + 1));
            if (key.return) {
                setMeta({...meta, status: STATUSES[tempStatusIndex]});
                setMode('menu');
            }
        } else if (mode === 'select-severity') {
            if (key.escape) setMode('menu');
            if (key.upArrow) setTempSeverityIndex(prev => Math.max(0, prev - 1));
            if (key.downArrow) setTempSeverityIndex(prev => Math.min(SEVERITIES.length - 1, prev + 1));
            if (key.return) {
                setMeta({...meta, severity: SEVERITIES[tempSeverityIndex]});
                setMode('menu');
            }
        } else if (mode === 'confirm-revert') {
            if (key.escape || input === 'n' || input === 'N') {
                setMode('menu');
            }
            if (input === 'y' || input === 'Y' || key.return) {
                if (issuePath) {
                    try {
                        spawnSync('git', ['checkout', '--', issuePath], {stdio: 'inherit'});
                        onBack();
                    } catch (err: any) {
                        setError(`Failed to revert: ${err.message}`);
                    }
                }
            }
        }
    });

    if (loading) return <Text>Loading issue editor...</Text>;
    if (error) return <Box flexDirection="column"><Text color="red">Error: {error}</Text><Text dimColor>Press Esc to go back</Text></Box>;

    const menuItems = [
        {label: 'Title', value: meta.title},
        {label: 'Status', value: meta.status || 'open'},
        {label: 'Severity', value: meta.severity || 'medium'},
        {label: 'Assignee', value: meta.assignee || 'Unassigned'},
        {label: 'Edit Content', value: '(External Editor)'},
        {label: '', value: '--------------------'},
        {label: saveLabel, value: ''},
        ...(showRevert && isDirty ? [{label: 'Revert Changes', value: ''}] : []),
        {label: 'Cancel', value: ''},
    ];

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">Issue Editor: {meta.id}</Text>
            <Box flexDirection="column" marginTop={1}>
                {menuItems.map((item, index) => (
                    <Box key={index}>
                        <Text color={selectedIndex === index && mode === 'menu' ? 'blue' : undefined}>
                            {selectedIndex === index && mode === 'menu' ? '❯ ' : '  '}
                        </Text>
                        <Box width={20}>
                            <Text bold={selectedIndex === index && mode === 'menu'}>{item.label}{item.label && ': '} </Text>
                        </Box>
                        {index === 0 && mode === 'edit-title' ? (
                            <TextInput 
                                value={tempTitle} 
                                onChange={setTempTitle} 
                                onSubmit={() => {
                                    setMeta({...meta, title: tempTitle});
                                    setMode('menu');
                                }}
                            />
                        ) : index === 3 && mode === 'edit-assignee' ? (
                            <Box flexDirection="column">
                                <Box>
                                    <TextInput 
                                        value={tempAssignee} 
                                        onChange={setTempAssignee}
                                        placeholder="Search by username or name..."
                                        onSubmit={() => {
                                            if (tempAssignee === '') {
                                                setMeta({...meta, assignee: ''});
                                                setMode('menu');
                                                return;
                                            }
                                            if (assigneeSuggestions.length > 0) {
                                                const selected = assigneeSuggestions[selectedSuggestionIndex].username;
                                                const newMeta = {...meta, assignee: selected};
                                                if (selected && meta.status === 'open') {
                                                    newMeta.status = 'assigned';
                                                }
                                                setMeta(newMeta);
                                                setMode('menu');
                                            }
                                        }}
                                    />
                                </Box>
                                {assigneeSuggestions.length > 0 && (
                                    <Box flexDirection="column" marginLeft={0} borderStyle="round" borderColor="blue">
                                        {assigneeSuggestions.slice(0, 5).map((suggestion, idx) => (
                                            <Text key={suggestion.username} color={selectedSuggestionIndex === idx ? 'blue' : 'gray'}>
                                                {selectedSuggestionIndex === idx ? '❯ ' : '  '}{suggestion.username} ({suggestion.name})
                                            </Text>
                                        ))}
                                        {assigneeSuggestions.length > 5 && <Text dimColor>  ... ({assigneeSuggestions.length - 5} more)</Text>}
                                    </Box>
                                )}
                            </Box>
                        ) : (
                            <Text color="yellow">{item.value}</Text>
                        )}
                    </Box>
                ))}
            </Box>

            {mode === 'select-status' && (
                <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="blue" paddingX={1}>
                    <Text bold underline>Select Status:</Text>
                    {STATUSES.map((status, index) => (
                        <Text key={status} color={tempStatusIndex === index ? 'blue' : undefined}>
                            {tempStatusIndex === index ? '❯ ' : '  '}{status}
                        </Text>
                    ))}
                </Box>
            )}

            {mode === 'select-severity' && (
                <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="blue" paddingX={1}>
                    <Text bold underline>Select Severity:</Text>
                    {SEVERITIES.map((severity, index) => (
                        <Text key={severity} color={tempSeverityIndex === index ? 'blue' : undefined}>
                            {tempSeverityIndex === index ? '❯ ' : '  '}{severity}
                        </Text>
                    ))}
                </Box>
            )}

            {mode === 'confirm-revert' && (
                <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="red" paddingX={1}>
                    <Text bold color="red">Are you sure you want to revert all changes to this issue folder?</Text>
                    <Text>This will undo all uncommitted edits to issue.yaml.</Text>
                    <Box marginTop={1}>
                        <Text bold>Y: Yes, revert | N: No, cancel</Text>
                    </Box>
                </Box>
            )}

            <Box marginTop={1}>
                <Text dimColor>
                    {mode === 'menu' ? "↑/↓: Navigate | Enter: Edit/Action | Esc: Cancel" : 
                     mode === 'confirm-revert' ? "Y: Confirm Revert | N/Esc: Cancel" :
                     mode.startsWith('select') ? "↑/↓: Select | Enter: Confirm | Esc: Back" :
                     "Enter: Confirm | Esc: Back"}
                </Text>
            </Box>
        </Box>
    );
}
