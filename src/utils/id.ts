import {customAlphabet} from 'nanoid';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

import {getAllIssueDirs} from './issues.js';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 7);

export function getAllExistingIds(issuesDirOverride?: string): Set<string> {
    const ids = new Set<string>();
    const issuesDir = issuesDirOverride || path.join('.dit', 'issues');

    if (!fs.existsSync(issuesDir)) {
        return ids;
    }

    try {
        const issueDirs = getAllIssueDirs(issuesDir);

        for (const issueDir of issueDirs) {
            const issueDirPath = path.join(issuesDir, issueDir);
            
            // Try to get ID from issue.yaml
            const issueYamlPath = path.join(issueDirPath, 'issue.yaml');
            if (fs.existsSync(issueYamlPath)) {
                try {
                    const content = fs.readFileSync(issueYamlPath, 'utf8');
                    const data = yaml.load(content) as any;
                    if (data && data.id) {
                        ids.add(String(data.id));
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }

            // Try to get IDs from comments
            try {
                const commentsDir = path.join(issueDirPath, 'comments');
                const searchDirs = [issueDirPath];
                if (fs.existsSync(commentsDir)) searchDirs.push(commentsDir);

                for (const searchDir of searchDirs) {
                    if (!fs.existsSync(searchDir)) continue;
                    const isRecursive = searchDir === commentsDir;
                    const files = fs.readdirSync(searchDir, isRecursive ? { recursive: true } : {} as any);
                    
                    for (const file of files) {
                        const fileStr = file.toString();
                        const baseName = path.basename(fileStr);
                        const isCommentFile = isRecursive ? fileStr.endsWith('.yaml') : (baseName.startsWith('comment-') && fileStr.endsWith('.yaml'));
                        
                        if (isCommentFile) {
                            const commentPath = path.join(searchDir, fileStr);
                            try {
                                const content = fs.readFileSync(commentPath, 'utf8');
                                const data = yaml.load(content) as any;
                                if (data && data.id) {
                                    ids.add(String(data.id));
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore readdir errors
            }
        }
    } catch (e) {
        // Ignore issuesDir readdir errors
    }

    return ids;
}

export function generateUniqueId(issuesDirOverride?: string): string {
    const existingIds = getAllExistingIds(issuesDirOverride);
    let id = nanoid();
    while (existingIds.has(id)) {
        id = nanoid();
    }
    return id;
}
