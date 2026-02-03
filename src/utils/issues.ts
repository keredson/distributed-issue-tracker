import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { execa } from 'execa';
import { generateSlug } from './slug.js';

const THRESHOLD = 128;

export function getIssueTargetDir(issuesDir: string, createdDate: string): string {
    const date = new Date(createdDate);
    
    // Level 1: .dit/issues/
    if (!fs.existsSync(issuesDir)) {
        return issuesDir;
    }
    
    const items = fs.readdirSync(issuesDir);
    if (items.length < THRESHOLD) {
        return issuesDir;
    }
    
    // Level 2: .dit/issues/yyyy/
    const year = date.getUTCFullYear().toString();
    const yearDir = path.join(issuesDir, year);
    if (!fs.existsSync(yearDir)) {
        return yearDir;
    }
    
    const yearItems = fs.readdirSync(yearDir);
    if (yearItems.length < THRESHOLD) {
        return yearDir;
    }
    
    // Level 3: .dit/issues/yyyy/mm/
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const monthDir = path.join(yearDir, month);
    if (!fs.existsSync(monthDir)) {
        return monthDir;
    }
    
    const monthItems = fs.readdirSync(monthDir);
    if (monthItems.length < THRESHOLD) {
        return monthDir;
    }
    
    // Level 4: .dit/issues/yyyy/mm/dd/
    const day = date.getUTCDate().toString().padStart(2, '0');
    return path.join(monthDir, day);
}

export function findIssueDirById(issuesDir: string, id: string): string | null {
    if (!fs.existsSync(issuesDir)) {
        return null;
    }

    try {
        const items = fs.readdirSync(issuesDir, { recursive: true });
        for (const item of items) {
            const itemStr = item.toString();
            // Look for directories that end with -ID and contain an issue.yaml
            if (itemStr.endsWith(`-${id}`)) {
                const fullPath = path.join(issuesDir, itemStr);
                if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'issue.yaml'))) {
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
        // Ensure it's a directory and contains issue.yaml
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
    
    const dateStr = updatedMeta.created || new Date().toISOString();
    const targetDir = getIssueTargetDir(issuesDir, dateStr);
    
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

export async function getFilesWithHistory(issueDir: string): Promise<Set<string>> {
    try {
        const {stdout: repoRootRaw} = await execa('git', ['rev-parse', '--show-toplevel']);
        const repoRoot = repoRootRaw.trim();
        const {stdout} = await execa('git', [
            'log', '--format=', '--name-only', '--diff-filter=M', '--', issueDir
        ], { cwd: repoRoot });
        
        const files = new Set<string>();
        stdout.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
                // git log --name-only returns paths relative to repo root
                files.add(path.resolve(repoRoot, trimmed));
            }
        });
        return files;
    } catch (e) {
        return new Set();
    }
}

export async function getIssueById(issuesDir: string, id: string): Promise<any | null> {
    const actualDir = findIssueDirById(issuesDir, id);
    if (!actualDir) return null;

    const issuePath = path.join(issuesDir, actualDir, 'issue.yaml');
    if (!fs.existsSync(issuePath)) return null;

    try {
        const dirtyPaths = await getDirtyPaths(issuesDir);
        const absoluteIssueDir = path.resolve(issuesDir, actualDir);
        const historyPaths = await getFilesWithHistory(absoluteIssueDir);

        const content = yaml.load(fs.readFileSync(issuePath, 'utf8')) as any;
        const comments = getCommentsForIssue(path.join(issuesDir, actualDir), dirtyPaths, historyPaths);
        
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
        for (const dirtyPath of dirtyPaths) {
            if (dirtyPath.startsWith(absoluteIssueDir)) {
                isDirty = true;
                break;
            }
        }

        const hasHistory = historyPaths.has(path.resolve(issuePath));

        return { ...content, comments, dir: actualDir, author, isDirty, hasHistory };
    } catch (e) {
        return null;
    }
}

export function getCommentsForIssue(issuePath: string, dirtyPaths?: Set<string>, historyPaths?: Set<string>): any[] {
    if (!fs.existsSync(issuePath)) return [];

    const comments: any[] = [];
    const files = fs.readdirSync(issuePath);

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

                let hasHistory = false;
                if (historyPaths) {
                    if (historyPaths.has(absoluteCommentPath)) {
                        hasHistory = true;
                    }
                }

                comments.push({ ...content, isDirty, hasHistory, file });
            } catch (e) {
                // Ignore
            }
        }
    }
    return comments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function getFileHistory(filePath: string): Promise<any[]> {
    try {
        const {stdout} = await execa('git', [
            'log', '--pretty=format:%H|%an|%ad|%s', '--date=iso', '--', filePath
        ]);
        
        if (!stdout.trim()) return [];

        return stdout.split('\n').map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
        });
    } catch (e) {
        return [];
    }
}

export async function getFileContentAtCommit(filePath: string, commitHash: string): Promise<string> {
    try {
        // We need the path relative to the repo root for git show
        const {stdout: repoRoot} = await execa('git', ['rev-parse', '--show-toplevel']);
        const relativePath = path.relative(repoRoot.trim(), filePath);
        
        const {stdout} = await execa('git', ['show', `${commitHash}:${relativePath}`]);
        return stdout;
    } catch (e) {
        return "";
    }
}

export async function getDiff(filePath: string, commit1: string, commit2: string): Promise<string> {
    try {
        const {stdout: repoRoot} = await execa('git', ['rev-parse', '--show-toplevel']);
        const relativePath = path.relative(repoRoot.trim(), filePath);
        
        // If commit2 is "current", diff against working tree
        const args = ['diff', commit1];
        if (commit2 !== 'current') {
            args.push(commit2);
        }
        args.push('--', relativePath);
        
        const {stdout} = await execa('git', args);
        return stdout;
    } catch (e) {
        return "";
    }
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
