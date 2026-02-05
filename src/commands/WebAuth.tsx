import React, {useEffect, useState} from 'react';
import {Text, Box, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const CONFIG_DIR = path.join('.dit', 'oauth');
const CONFIG_PATH = path.join(CONFIG_DIR, 'github.yaml');
const DEFAULT_SCOPES = ['read:user', 'user:email'];
const DEFAULT_REDIRECT_BASE_URL = 'http://localhost:1337';

type Step = 'checking' | 'confirm-overwrite' | 'client-id' | 'done';

export default function WebAuth({onBack}: {onBack?: () => void}) {
    const [step, setStep] = useState<Step>('checking');
    const [clientId, setClientId] = useState('');
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

    const ensureConfigDir = () => {
        if (fs.existsSync(CONFIG_DIR)) {
            const stat = fs.statSync(CONFIG_DIR);
            if (!stat.isDirectory()) {
                throw new Error(`${CONFIG_DIR} exists and is not a directory.`);
            }
        } else {
            fs.mkdirSync(CONFIG_DIR, {recursive: true});
        }
    };

    useEffect(() => {
        try {
            ensureConfigDir();
        } catch (err: any) {
            setError(err.message);
            return;
        }
        if (fs.existsSync(CONFIG_PATH)) {
            setStep('confirm-overwrite');
        } else {
            setStep('client-id');
        }
    }, []);

    const writeConfig = () => {
        ensureConfigDir();
        const doc: any = {
            client_id: clientId.trim(),
            scopes: DEFAULT_SCOPES,
            redirect_base_url: DEFAULT_REDIRECT_BASE_URL
        };
        fs.writeFileSync(CONFIG_PATH, yaml.dump(doc, {lineWidth: -1}), 'utf8');
    };

    const handleOverwriteSubmit = (value: string) => {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'y' || normalized === 'yes') {
            setStep('client-id');
            return;
        }
        setError('Confirm overwrite with "y" or press Esc to cancel.');
        setOverwriteInput('');
    };

    const handleClientIdSubmit = (value: string) => {
        if (!value.trim()) {
            setError('Client ID cannot be empty.');
            return;
        }
        setClientId(value.trim());
        setError(null);
        try {
            writeConfig();
            setStep('done');
        } catch (err: any) {
            setError(`Failed to write config: ${err.message}`);
        }
    };

    useInput((_input, key) => {
        if (key.escape) {
            handleBack();
        }
    });

    useEffect(() => {
        if (step === 'done') {
            handleBack();
        }
    }, [step]);

    if (step === 'done') {
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="green">Saved GitHub OAuth config at {CONFIG_PATH}.</Text>
                <Text color="gray">Start the web server and use the GitHub login button in the web UI to connect.</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">Configure GitHub OAuth</Text>
            {step === 'confirm-overwrite' && (
                <Box marginTop={1}>
                    <Text>Config exists at {CONFIG_PATH}. Overwrite? (y/N): </Text>
                    <TextInput
                        value={overwriteInput}
                        onChange={(val) => {
                            setOverwriteInput(val);
                            setError(null);
                        }}
                        onSubmit={handleOverwriteSubmit}
                    />
                </Box>
            )}
            {step === 'client-id' && (
                <Box marginTop={1} flexDirection="column">
                    <Box flexDirection="column">
                        <Text>GitHub Client ID</Text>
                        <Text color="gray">Public ID for your GitHub OAuth app (not a secret).</Text>
                        <Text color="gray">Needed to start GitHub device login for this web UI.</Text>
                        <Text color="gray">Create one at: https://github.com/settings/developers</Text>
                        <Text color="gray">Homepage and Authorization callback URLs can be whatever you want.</Text>
                        <Text color="gray">(They're required by GitHub but not used by DIT.)</Text>
                        <Text color="gray">Enable Device Flow in the app settings.</Text>
                        <Text color="gray">OAuth Apps → New OAuth App → copy the Client ID.</Text>
                    </Box>
                    <Box marginTop={1}>
                        <Text>Enter GitHub Client ID: </Text>
                        <TextInput
                            value={clientId}
                            onChange={(val) => {
                                setClientId(val);
                                setError(null);
                            }}
                            onSubmit={handleClientIdSubmit}
                        />
                    </Box>
                </Box>
            )}
            {error && <Text color="red">{error}</Text>}
            <Box marginTop={1}>
                <Text dimColor>Press Enter to confirm | Esc to cancel</Text>
            </Box>
        </Box>
    );
}
