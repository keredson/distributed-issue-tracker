import React, {useState, useEffect} from 'react';
import {Text, Box, useInput, useApp} from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import {spawnSync} from 'node:child_process';
import {generateUniqueId} from '../utils/id.js';
import {generateSlug} from '../utils/slug.js';
import {findIssueDirById} from '../utils/issues.js';
import {execa} from 'execa';

type Props = {
    id: string;
    replyTo?: string;
    parentContent?: string;
    onBack?: () => void;
};

export default function IssueComment({id, replyTo, parentContent, onBack}: Props) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [issuePath, setIssuePath] = useState<string | null>(null);
    const [tempCommentPath, setTempCommentPath] = useState<string | null>(null);
    const {exit} = useApp();

    const handleSave = async (currentIssuePath: string, currentTempPath: string) => {
        try {
            const rawBody = fs.readFileSync(currentTempPath, 'utf8');
            const body = rawBody.split('<!-- DIT: Everything below this line is ignored. Leave your content above. -->')[0].trim();

            if (!body) {
                if (onBack) onBack(); else exit();
                return;
            }

            const commentId = generateUniqueId();
            // Create a slug from the first line or first 20 chars
            const firstLine = body.split('\n')[0] || '';
            const slug = generateSlug(firstLine.substring(0, 20), 20);
            
            const commentFileName = `comment-${slug}-${commentId}.yaml`;
            const commentPath = path.join(currentIssuePath, commentFileName);

            // Get author from git
            let author = 'Local';
            try {
                const {stdout} = await execa('git', ['config', 'user.name']);
                author = stdout.trim() || 'Local';
            } catch (e) {
                // Ignore
            }

            const commentData: any = {
                id: commentId,
                author,
                date: new Date().toISOString(),
                body: body.trim() + '\n'
            };

            if (replyTo) {
                commentData.reply_to = replyTo;
            }

            fs.writeFileSync(commentPath, yaml.dump(commentData, {lineWidth: -1, styles: {'!!str': 'literal'}}));
            
            // Auto git add if it's a git repo
            try {
                await execa('git', ['add', commentPath]);
            } catch (e) {
                // Ignore
            }

            if (onBack) {
                onBack();
            } else {
                exit();
            }
        } catch (err: any) {
            setError(`Error saving comment: ${err.message}`);
        }
    };

    useEffect(() => {
        const issuesDir = path.join('.dit', 'issues');
        const issueDirName = findIssueDirById(issuesDir, id);

        if (!issueDirName) {
            setError(`Issue with ID ${id} not found`);
            setLoading(false);
            return;
        }

        const fullPath = path.join(issuesDir, issueDirName);
        setIssuePath(fullPath);
        
        // Create temp file for comment with instructions
        const tempPath = path.join(os.tmpdir(), `dit-comment-${id}-${Date.now()}.md`);
        const contextLabel = replyTo ? `Replying to comment ${replyTo}:` : `Replying to issue ${issueDirName}:`;
        let instructions = `

<!-- DIT: Everything below this line is ignored. Leave your content above. -->
Please enter the comment message for your issue (Markdown formatted). 
An empty message aborts the comment.

${contextLabel}

`;
        if (parentContent) {
            instructions += parentContent.split('\n').map(line => `> ${line}`).join('\n') + '\n';
        }

        fs.writeFileSync(tempPath, instructions);
        setTempCommentPath(tempPath);
        setLoading(false);

        // Automatically open editor
        const editor = process.env.EDITOR || 'vi';
        spawnSync(editor, [tempPath], {stdio: 'inherit'});

        // Automatically save after editor closes
        handleSave(fullPath, tempPath);
        
        return () => {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        };
    }, [id]);

    useInput((input, key) => {
        if (key.escape) {
            if (onBack) onBack(); else exit();
        }
    });

    if (loading) return <Text>Initializing comment editor...</Text>;
    if (error) return (
        <Box flexDirection="column" padding={1}>
            <Text color="red">Error: {error}</Text>
            <Text dimColor>Press Esc to go back</Text>
        </Box>
    );

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">Processing comment for issue {id}...</Text>
        </Box>
    );
}
