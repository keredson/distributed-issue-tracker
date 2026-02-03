import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { execa } from 'execa';
import { generateSlug } from './slug.js';

export function findIssueDirById(issuesDir: string, id: string): string | null {
    if (!fs.existsSync(issuesDir)) {
        return null;
    }

    try {
        const items = fs.readdirSync(issuesDir, { recursive: true });
        for (const item of items) {
            const itemStr = item.toString();
            if (itemStr.endsWith(`-${id}`)) {
                const fullPath = path.join(issuesDir, itemStr);
                if (fs.statSync(fullPath).isDirectory()) {
                    return itemStr;
                }
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

export function getAllIssueDirs(issuesDir: string): string[] {
    if (!fs.existsSync(issuesDir)) {
        return [];
    }

    const issueDirs: string[] = [];
    const items = fs.readdirSync(issuesDir, { recursive: true });
    
    for (const item of items) {
        const itemStr = item.toString();
        const fullPath = path.join(issuesDir, itemStr);
        if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'issue.yaml'))) {
            issueDirs.push(itemStr);
        }
    }
    
    return issueDirs;
}

export async function saveIssue(meta: any, skipAdd: boolean = false, issuesDir: string = path.join('.dit', 'issues')): Promise<string> {
    const updatedMeta = {
        ...meta,
        body: (meta.body || '').trim() + '\n'
    };
    const slug = generateSlug(updatedMeta.title);
    const id = updatedMeta.id;
    const finalDirName = `${slug}-${id}`;
    
    const date = new Date(updatedMeta.created || new Date().toISOString());
    const year = date.getUTCFullYear().toString();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const targetDir = path.join(issuesDir, year, month);
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, {recursive: true});
    }
    
    const finalPath = path.join(targetDir, finalDirName);
    
    if (fs.existsSync(finalPath)) {
        throw new Error(`Issue directory ${finalDirName} already exists.`);
    }

    fs.mkdirSync(finalPath, {recursive: true});
    fs.writeFileSync(path.join(finalPath, 'issue.yaml'), yaml.dump(updatedMeta, {lineWidth: -1, styles: {'!!str': 'literal'}}));
    
    if (!skipAdd) {
        try {
            await execa('git', ['add', finalPath]);
        } catch (gitErr) {
            // Fail silently
        }
    }

    return finalPath;
}

export function findIssueByExternalId(externalId: string, issuesDir: string = path.join('.dit', 'issues')): string | null {
    if (!fs.existsSync(issuesDir)) return null;

    const dirs = getAllIssueDirs(issuesDir);
    for (const dir of dirs) {
        const issuePath = path.join(issuesDir, dir, 'issue.yaml');
        if (fs.existsSync(issuePath)) {
            try {
                const content = yaml.load(fs.readFileSync(issuePath, 'utf8')) as any;
                if (content && content.external_id === externalId) {
                    return path.join(issuesDir, dir);
                }
            } catch (e) {
                // Ignore
            }
        }
    }
    return null;
}

export function findCommentByExternalId(issuePath: string, externalId: string): string | null {
    if (!fs.existsSync(issuePath)) return null;

    const files = fs.readdirSync(issuePath);
    for (const file of files) {
        if (file.startsWith('comment-') && file.endsWith('.yaml')) {
            const commentPath = path.join(issuePath, file);
            try {
                const content = yaml.load(fs.readFileSync(commentPath, 'utf8')) as any;
                if (content && content.external_id === externalId) {
                    return commentPath;
                }
            } catch (e) {
                // Ignore
            }
        }
    }
    return null;
}

export async function saveComment(issuePath: string, commentData: any, skipAdd: boolean = false): Promise<string> {
    const commentId = commentData.id;
    const firstLine = (commentData.body || '').split('\n')[0] || '';
    const slug = generateSlug(firstLine.substring(0, 20), 20);
    
    const commentFileName = `comment-${slug}-${commentId}.yaml`;
    const commentPath = path.join(issuePath, commentFileName);

    fs.writeFileSync(commentPath, yaml.dump({
        ...commentData,
        body: (commentData.body || '').trim() + '\n'
    }, {lineWidth: -1, styles: {'!!str': 'literal'}}));
    
    if (!skipAdd) {
        try {
            await execa('git', ['add', commentPath]);
        } catch (e) {
            // Ignore
        }
    }

    return commentPath;
}

export async function getDirtyPaths(issuesDir: string): Promise<Set<string>> {
    try {
        const {stdout: repoRoot} = await execa('git', ['rev-parse', '--show-toplevel'], {
            cwd: process.cwd()
        });
        const {stdout: gitDiff} = await execa('git', ['diff', 'HEAD', '--name-only', issuesDir], {
            cwd: process.cwd()
        });
        const {stdout: gitUntracked} = await execa('git', ['ls-files', '--others', '--exclude-standard', issuesDir], {
            cwd: process.cwd()
        });
        
        const dirtyPaths = new Set<string>();
        const root = repoRoot.trim();
        [gitDiff, gitUntracked].forEach(output => {
            output.split('\n').forEach(line => {
                if (!line) return;
                // Ensure dirty paths are absolute for reliable comparison
                dirtyPaths.add(path.resolve(root, line.trim()));
            });
        });
        return dirtyPaths;
    } catch (e) {
        return new Set();
    }
}

export async function getIssueById(issuesDir: string, id: string): Promise<any | null> {
    const dir = findIssueDirById(issuesDir, id);
    if (!dir) return null;

    // We need to find the actual path which includes year/month
    const allDirs = getAllIssueDirs(issuesDir);
    const actualDir = allDirs.find(d => d.endsWith(`-${id}`));
    if (!actualDir) return null;

    const issuePath = path.join(issuesDir, actualDir, 'issue.yaml');
    if (!fs.existsSync(issuePath)) return null;

    try {
        const dirtyPaths = await getDirtyPaths(issuesDir);
        const content = yaml.load(fs.readFileSync(issuePath, 'utf8')) as any;
        const comments = getCommentsForIssue(path.join(issuesDir, actualDir), dirtyPaths);
        
        let author = content.author;
        if (!author) {
            try {
                const {stdout} = await execa('git', [
                    'log', '--diff-filter=A', '--format=%an', '-n', '1', '--', issuePath
                ]);
                author = stdout.trim() || 'Local';
            } catch (e) {
                author = 'Local';
            }
        }

        let isDirty = false;
        const absoluteIssueDir = path.resolve(issuesDir, actualDir);
        for (const dirtyPath of dirtyPaths) {
            if (dirtyPath.startsWith(absoluteIssueDir)) {
                isDirty = true;
                break;
            }
        }

        return { ...content, comments, dir: actualDir, author, isDirty };
    } catch (e) {
        return null;
    }
}

export function getCommentsForIssue(issuePath: string, dirtyPaths?: Set<string>): any[] {
    if (!fs.existsSync(issuePath)) return [];

    const comments: any[] = [];
    const files = fs.readdirSync(issuePath);
    const absoluteIssuePath = path.resolve(issuePath);

    for (const file of files) {
        if (file.startsWith('comment-') && file.endsWith('.yaml')) {
            try {
                const commentFilePath = path.join(issuePath, file);
                const absoluteCommentPath = path.resolve(commentFilePath);
                const content = yaml.load(fs.readFileSync(commentFilePath, 'utf8')) as any;
                // Normalize date/created
                content.date = content.date || content.created;

                let isDirty = false;
                if (dirtyPaths) {
                    if (dirtyPaths.has(absoluteCommentPath)) {
                        isDirty = true;
                    }
                }

                comments.push({ ...content, isDirty });
            } catch (e) {
                // Ignore
            }
        }
    }
    return comments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getCommentCountForIssue(issuePath: string): number {
    if (!fs.existsSync(issuePath)) return 0;
    
    let count = 0;
    const files = fs.readdirSync(issuePath);
    for (const file of files) {
        if (file.startsWith('comment-') && file.endsWith('.yaml')) {
            count++;
        }
    }
    return count;
}

export async function getAllIssues(issuesDir: string): Promise<any[]> {
    const dirs = getAllIssueDirs(issuesDir);
    const issues: any[] = [];
    const dirtyPaths = await getDirtyPaths(issuesDir);

    for (const dir of dirs) {
        const fullIssuePath = path.join(issuesDir, dir);
        const issuePath = path.join(fullIssuePath, 'issue.yaml');
        try {
            const content = yaml.load(fs.readFileSync(issuePath, 'utf8')) as any;
            const comments_count = getCommentCountForIssue(fullIssuePath);
            
            let author = content.author;
            if (!author) {
                try {
                    const {stdout} = await execa('git', [
                        'log', '--diff-filter=A', '--format=%an', '-n', '1', '--', issuePath
                    ]);
                    author = stdout.trim() || 'Local';
                } catch (e) {
                    author = 'Local';
                }
            }

            let isDirty = false;
            const absoluteIssueDir = path.resolve(issuesDir, dir);
            for (const dirtyPath of dirtyPaths) {
                if (dirtyPath.startsWith(absoluteIssueDir)) {
                    isDirty = true;
                    break;
                }
            }

            issues.push({ ...content, dir, comments_count, author, isDirty });
        } catch (e) {
            // Ignore
        }
    }
    return issues.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}
