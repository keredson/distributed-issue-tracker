import React, {useState, useEffect} from 'react';
import {Text, useApp, useInput, Box} from 'ink';
import {generateUniqueId} from '../utils/id.js';
import {generateSlug} from '../utils/slug.js';
import {getIssueTargetDir} from '../utils/issues.js';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {execa} from 'execa';
import IssueEdit from './IssueEdit.js';
import { getCurrentLocalUser } from '../utils/user.js';
import { loadIssueWorkflow, getDefaultIssueStatus } from '../utils/workflow.js';

export default function NewIssue({skipAdd, onBack}: {skipAdd?: boolean; onBack?: () => void}) {
    const [issueId] = useState(() => generateUniqueId());
    const [tempPath, setTempPath] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
    const [templates, setTemplates] = useState<string[]>([]);
    const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [checkedTemplates, setCheckedTemplates] = useState(false);
    const [config, setConfig] = useState<any>({});
    const {exit} = useApp();

    useEffect(() => {
        const configPath = path.join('.dit', 'config.yaml');
        let currentConfig: any = {};
        if (fs.existsSync(configPath)) {
            try {
                currentConfig = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
            } catch (e) {
                // Ignore config parse errors
            }
        }
        setConfig(currentConfig);

        const templatesDir = path.join('.dit', 'templates');
        let foundTemplates: string[] = [];
        if (fs.existsSync(templatesDir)) {
            foundTemplates = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
        }

        const templateConfig = currentConfig.template || {};
        if (foundTemplates.length > 0) {
            let finalTemplates: string[] = [];
            if (templateConfig.required) {
                finalTemplates = foundTemplates;
            } else {
                finalTemplates = ['None', ...foundTemplates];
            }
            setTemplates(finalTemplates);

            // Handle default template selection
            if (templateConfig.default) {
                const defaultName = templateConfig.default.endsWith('.md') ? templateConfig.default : `${templateConfig.default}.md`;
                const defaultIndex = finalTemplates.indexOf(defaultName);
                if (defaultIndex !== -1) {
                    setSelectedTemplateIndex(defaultIndex);
                }
            }
            
            setShowTemplatePicker(true);
        } else if (templateConfig.required) {
            setError('A template is required by configuration (.dit/config.yaml), but no templates were found in .dit/templates/.');
        }
        
        setCheckedTemplates(true);
    }, []);

    const initIssue = async (templateContent: string = '\n') => {
        const issuesDir = path.join('.dit', 'issues');
        if (!fs.existsSync(issuesDir)) {
            fs.mkdirSync(issuesDir, {recursive: true});
        }
        
        const currentUser = await getCurrentLocalUser();
        const workflow = loadIssueWorkflow();
        const defaultStatus = getDefaultIssueStatus(workflow);
        
        const tp = path.join(issuesDir, `.tmp-${issueId}`);
        try {
            if (!fs.existsSync(tp)) {
                fs.mkdirSync(tp, {recursive: true});
                // Initialize empty issue files
                const descriptionPath = path.join(tp, 'description.md');
                fs.writeFileSync(path.join(tp, 'meta.yaml'), yaml.dump({
                    id: issueId,
                    title: 'New Issue',
                    created: new Date().toISOString(),
                    status: defaultStatus,
                    severity: 'medium',
                    assignee: '',
                    author: currentUser?.username || '',
                    labels: []
                }, {lineWidth: -1, styles: {'!!str': 'literal'}}));
                fs.writeFileSync(descriptionPath, templateContent || '\n');
            }
            setTempPath(tp);
            setShowTemplatePicker(false);
        } catch (err: any) {
            setError(`Failed to create temp directory: ${err.message}`);
        }
    };

    useEffect(() => {
        if (checkedTemplates && !showTemplatePicker && !tempPath && !error) {
            initIssue();
        }
    }, [checkedTemplates, showTemplatePicker, tempPath, error]);

    useInput((_input, key) => {
        if (showTemplatePicker) {
            if (key.upArrow) {
                setSelectedTemplateIndex(prev => Math.max(0, prev - 1));
            }
            if (key.downArrow) {
                setSelectedTemplateIndex(prev => Math.min(templates.length - 1, prev + 1));
            }
            if (key.return) {
                let content = '\n';
                const templateName = templates[selectedTemplateIndex];
                if (templateName && templateName !== 'None') {
                    const templatePath = path.join('.dit', 'templates', templateName);
                    content = fs.readFileSync(templatePath, 'utf8');
                }
                initIssue(content);
            }
            if (key.escape) {
                handleCancel();
            }
        }
    });

    const handleSave = async (meta: any) => {
        if (!tempPath) return;
        
        try {
            const updatedMeta = {
                ...meta,
                body: (meta.body || '').trim() + '\n'
            };
            const slug = generateSlug(updatedMeta.title);
            const finalDirName = `${slug}-${issueId}`;
            const issuesDir = path.join('.dit', 'issues');
            
            const targetDir = getIssueTargetDir(issuesDir, updatedMeta.created || new Date().toISOString());
            
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, {recursive: true});
            }
            
            const finalPath = path.join(targetDir, finalDirName);
            
            // Update meta.yaml and description.md in temp path before moving
            const { body, ...metaOnly } = updatedMeta;
            fs.writeFileSync(path.join(tempPath, 'meta.yaml'), yaml.dump(metaOnly, {lineWidth: -1, styles: {'!!str': 'literal'}}));
            fs.writeFileSync(path.join(tempPath, 'description.md'), body || '\n');
            
            // Rename temp to final
            if (fs.existsSync(finalPath)) {
                // This shouldn't happen with generateUniqueId but just in case
                setError(`Issue directory ${finalDirName} already exists.`);
                return;
            }
            
            fs.renameSync(tempPath, finalPath);
            
            if (!skipAdd) {
                try {
                    await execa('git', ['add', finalPath]);
                } catch (gitErr) {
                    // Fail silently
                }
            }
            if (onBack) {
                onBack();
            } else {
                exit();
            }
        } catch (err: any) {
            setError(`Failed to save issue: ${err.message}`);
        }
    };

    const handleCancel = () => {
        if (tempPath && fs.existsSync(tempPath)) {
            try {
                fs.rmSync(tempPath, {recursive: true, force: true});
            } catch (err) {
                // Ignore cleanup errors
            }
        }
        if (onBack) {
            onBack();
        } else {
            exit();
        }
    };

    if (error) {
        return <Text color="red">Error: {error}</Text>;
    }

    if (showTemplatePicker) {
        return (
            <Box flexDirection="column" padding={1}>
                <Text bold color="cyan">Select a template for the new issue:</Text>
                <Box flexDirection="column" marginTop={1}>
                    {templates.map((template, index) => (
                        <Text key={template} color={selectedTemplateIndex === index ? 'blue' : undefined}>
                            {selectedTemplateIndex === index ? '❯ ' : '  '}{template}
                        </Text>
                    ))}
                </Box>
                <Box marginTop={1}>
                    <Text dimColor>↑/↓: Navigate | Enter: Select | Esc: Cancel</Text>
                </Box>
            </Box>
        );
    }

    if (!tempPath) {
        return <Text>Initializing new issue...</Text>;
    }

    return (
        <IssueEdit 
            id={issueId} 
            issuePath={tempPath} 
            onSave={handleSave} 
            onBack={handleCancel}
            saveLabel="Create Issue"
            showRevert={false}
        />
    );
}
