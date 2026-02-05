import React, {useState, useEffect} from 'react';
import {Text, Box, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_WORKFLOW_NAME = 'issue.mmd';
const WORKFLOWS_DIR = path.join('.dit', 'workflows');
const GITIGNORE_PATH = '.gitignore';
const GITIGNORE_ENTRY = '.dit/secrets/';

const DEFAULT_CONTENT = `stateDiagram-v2
    [*] --> open
    open --> active: start
    active --> closed: resolve
    active --> open: pause
    closed --> open: reopen

    %% icon values use lucide icon names
    classDef openState fill:#E6FFED,stroke:#16A34A,color:#166534,icon:circle-dot;
    classDef activeState fill:#FEF3C7,stroke:#D97706,color:#92400E,icon:clock;
    classDef closedState fill:#EDE9FE,stroke:#7C3AED,color:#5B21B6,icon:check-circle-2;

    class open openState
    class active activeState
    class closed closedState
`;

export default function Init({onBack}: {onBack?: () => void}) {
    const [step, setStep] = useState<'working' | 'confirm-overwrite' | 'done'>('working');
    const [targetPath, setTargetPath] = useState<string | null>(null);
    const [overwriteInput, setOverwriteInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const {exit} = useApp();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            exit();
        }
    };

    const writeWorkflow = (filePath: string) => {
        fs.mkdirSync(path.dirname(filePath), {recursive: true});
        fs.writeFileSync(filePath, DEFAULT_CONTENT, 'utf8');
    };

    const ensureGitignore = () => {
        let gitignoreContent = '';
        if (fs.existsSync(GITIGNORE_PATH)) {
            gitignoreContent = fs.readFileSync(GITIGNORE_PATH, 'utf8');
        }

        const lines = gitignoreContent.split(/\r?\n/);
        const hasEntry = lines.some((line) => {
            const trimmed = line.trim();
            return trimmed === GITIGNORE_ENTRY || trimmed === GITIGNORE_ENTRY.replace(/\/$/, '');
        });
        if (!hasEntry) {
            const needsLeadingNewline = gitignoreContent.length > 0 && !gitignoreContent.endsWith('\n');
            const prefix = needsLeadingNewline ? '\n' : '';
            fs.appendFileSync(GITIGNORE_PATH, `${prefix}${GITIGNORE_ENTRY}\n`, 'utf8');
        }
    };

    const initDefaultWorkflow = () => {
        const nextPath = path.join(WORKFLOWS_DIR, DEFAULT_WORKFLOW_NAME);
        setTargetPath(nextPath);

        try {
            ensureGitignore();
        } catch (err: any) {
            setError(`Failed to update .gitignore: ${err.message}`);
            return;
        }

        if (fs.existsSync(nextPath)) {
            setOverwriteInput('');
            setStep('confirm-overwrite');
            return;
        }

        try {
            writeWorkflow(nextPath);
            setStep('done');
        } catch (err: any) {
            setError(`Failed to create workflow: ${err.message}`);
        }
    };

    const handleOverwriteSubmit = (value: string) => {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'y' || normalized === 'yes') {
            if (!targetPath) {
                setError('Missing target path for overwrite.');
                setStep('confirm-overwrite');
                return;
            }
            try {
                writeWorkflow(targetPath);
                setStep('done');
            } catch (err: any) {
                setError(`Failed to overwrite workflow: ${err.message}`);
                setStep('confirm-overwrite');
            }
            return;
        }

        setError('Confirm overwrite with "y" or press Esc to cancel.');
        setOverwriteInput('');
        setStep('confirm-overwrite');
    };

    useInput((_input, key) => {
        if (key.escape) {
            handleBack();
        }
    });

    useEffect(() => {
        initDefaultWorkflow();
    }, []);
    
    useEffect(() => {
        if (step === 'done') {
            handleBack();
        }
    }, [step]);

    if (step === 'done') {
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="green">Initialized workflow at {targetPath || path.join(WORKFLOWS_DIR, DEFAULT_WORKFLOW_NAME)}.</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">Initialize dit</Text>
            {step === 'confirm-overwrite' && (
                <>
                    <Box marginTop={1}>
                        <Text>File exists: {targetPath || path.join(WORKFLOWS_DIR, DEFAULT_WORKFLOW_NAME)}. Overwrite? (y/N): </Text>
                        <TextInput
                            value={overwriteInput}
                            onChange={(val) => {
                                setOverwriteInput(val);
                                setError(null);
                            }}
                            onSubmit={handleOverwriteSubmit}
                        />
                    </Box>
                </>
            )}
            {error && <Text color="red">{error}</Text>}
        </Box>
    );
}
