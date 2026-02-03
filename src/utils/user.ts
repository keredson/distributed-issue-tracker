import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { generateSlug } from './slug.js';
import { nanoid } from 'nanoid';

const USERS_DIR = '.dit/users';

export interface GitUser {
    name: string;
    email: string;
}

export interface LocalUser {
    username: string; // folder name
    name: string;
    email: string;
    passkeys?: any[];
}

export async function getGitConfig(): Promise<GitUser> {
    try {
        const { stdout: name } = await execa('git', ['config', 'user.name']);
        const { stdout: email } = await execa('git', ['config', 'user.email']);
        return { name: name.trim(), email: email.trim() };
    } catch (e) {
        throw new Error('Failed to retrieve git configuration. Are you in a git repository?');
    }
}

export async function getLocalUsers(): Promise<LocalUser[]> {
    try {
        await fs.access(USERS_DIR);
    } catch {
        return [];
    }

    const entries = await fs.readdir(USERS_DIR, { withFileTypes: true });
    const users: LocalUser[] = [];

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const infoPath = path.join(USERS_DIR, entry.name, 'info.yaml');
            try {
                const content = await fs.readFile(infoPath, 'utf8');
                const parsed = yaml.load(content) as any;
                if (parsed && parsed.name && parsed.email) {
                    const passkeysDir = path.join(USERS_DIR, entry.name, 'passkeys');
                    let passkeys: any[] = [];
                    try {
                        const pkFiles = await fs.readdir(passkeysDir);
                        for (const file of pkFiles) {
                            if (file.endsWith('.yaml')) {
                                const pkContent = await fs.readFile(path.join(passkeysDir, file), 'utf8');
                                passkeys.push(yaml.load(pkContent));
                            }
                        }
                    } catch (e) {
                        // passkeys dir might not exist
                    }

                    users.push({
                        username: entry.name,
                        name: parsed.name,
                        email: parsed.email,
                        passkeys: passkeys
                    });
                }
            } catch (e) {
                // Ignore invalid or missing info.yaml
            }
        }
    }
    return users;
}

export async function getCurrentLocalUser(): Promise<(LocalUser & { isVirtual?: boolean }) | null> {
    try {
        const gitUser = await getGitConfig();
        const localUsers = await getLocalUsers();
        const found = localUsers.find(u => u.email === gitUser.email);
        if (found) return found;
        
        // Fallback: return a virtual user based on git config if not found in .dit/users
        return {
            username: gitUser.name || gitUser.email.split('@')[0],
            name: gitUser.name,
            email: gitUser.email,
            isVirtual: true
        };
    } catch (e) {
        return null;
    }
}

export async function createUser(username: string, gitUser: GitUser): Promise<void> {
    const userDir = path.join(USERS_DIR, username);
    await fs.mkdir(userDir, { recursive: true });
    
    const info = {
        name: gitUser.name,
        email: gitUser.email,
    };
    
    const infoPath = path.join(userDir, 'info.yaml');
    await fs.writeFile(infoPath, yaml.dump(info));
    
    try {
        await execa('git', ['add', infoPath]);
    } catch (e) {
        // Ignore git add errors (e.g. if not in a git repo, though getGitConfig would have failed)
    }
}

export async function savePasskey(username: string, passkeyData: any): Promise<void> {
    const passkeysDir = path.join(USERS_DIR, username, 'passkeys');
    await fs.mkdir(passkeysDir, { recursive: true });

    const { name, ...data } = passkeyData;
    const slug = generateSlug(name || 'passkey');
    const id = nanoid(7).toLowerCase();
    const filename = `${slug}-${id}.yaml`;
    const filePath = path.join(passkeysDir, filename);

    const content = {
        name: name || 'Unnamed Passkey',
        created_at: new Date().toISOString(),
        ...data
    };

    await fs.writeFile(filePath, yaml.dump(content));
    
    try {
        await execa('git', ['add', filePath]);
    } catch (e) {
        // Ignore
    }
}
