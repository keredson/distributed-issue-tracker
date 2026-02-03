import React, {useState} from 'react';
import {Text, Box, useInput, useApp} from 'ink';
import TextInput from 'ink-text-input';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {execa} from 'execa';

export default function NewTemplate({onBack}: {onBack?: () => void}) {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const {exit} = useApp();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            exit();
        }
    };

    const handleSubmit = async () => {
        if (!name) {
            setError('Template name cannot be empty');
            return;
        }

        const templatesDir = path.join('.dit', 'templates');
        if (!fs.existsSync(templatesDir)) {
            fs.mkdirSync(templatesDir, {recursive: true});
        }

        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        const filePath = path.join(templatesDir, fileName);

        let content = '';
        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf8');
        } else {
            content = `# ${name}\n\n`;
        }

        const instructions = `

<!-- DIT: Everything below this line is ignored. Leave your content above. -->
# Please enter the content for your template (Markdown formatted).
# Template: ${name}
`;

        const tempFilePath = path.join(os.tmpdir(), `dit-template-${name}-${Date.now()}.md`);
        try {
            fs.writeFileSync(tempFilePath, content + instructions);

            const editor = process.env.EDITOR || 'vi';
            spawnSync(editor, [tempFilePath], {stdio: 'inherit'});

            if (fs.existsSync(tempFilePath)) {
                const rawResult = fs.readFileSync(tempFilePath, 'utf8');
                const finalContent = rawResult.split('<!-- DIT: Everything below this line is ignored. Leave your content above. -->')[0].trim();
                
                fs.writeFileSync(filePath, finalContent + '\n');
                fs.unlinkSync(tempFilePath);

                try {
                    await execa('git', ['add', filePath]);
                } catch (e) {
                    // Ignore if not a git repo or other git errors
                }
            }

            handleBack();
        } catch (err: any) {
            setError(`Failed to create or edit template: ${err.message}`);
        }
    };

    useInput((_input, key) => {
        if (key.escape) {
            handleBack();
        }
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">Create New Template</Text>
            <Box marginTop={1}>
                <Text>Enter template name: </Text>
                <TextInput 
                    value={name} 
                    onChange={(val) => {
                        setName(val);
                        setError(null);
                    }} 
                    onSubmit={handleSubmit}
                />
            </Box>
            {error && <Text color="red">{error}</Text>}
            <Box marginTop={1}>
                <Text dimColor>Press Enter to confirm | Esc to cancel</Text>
            </Box>
        </Box>
    );
}
