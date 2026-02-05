import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { generateSlug } from './slug.js';
import { nanoid } from 'nanoid';

const USERS_DIR = '.dit/users';

export interface GitUser {
    name: string;
    email?: string;
}

export interface LocalUser {
    username: string; // folder name
    name: string;
    email?: string;
    profilePic?: string;
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
            const infoPath = path.join(USERS_DIR, entry.name, 'meta.yaml');
            try {
                const content = await fs.readFile(infoPath, 'utf8');
                const parsed = yaml.load(content) as any;
                if (parsed && parsed.name) {
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

                    let profilePic: string | undefined;
                    const possiblePics = ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp'];
                    for (const pic of possiblePics) {
                        try {
                            const picPath = path.join(USERS_DIR, entry.name, pic);
                            await fs.access(picPath);
                            profilePic = picPath;
                            break;
                        } catch {}
                    }

                    users.push({
                        username: entry.name,
                        name: parsed.name,
                        email: parsed.email,
                        profilePic: profilePic,
                        passkeys: passkeys
                    });
                }
            } catch (e) {
                // Ignore invalid or missing meta.yaml
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
            username: gitUser.name || (gitUser.email ? gitUser.email.split('@')[0] : 'unknown'),
            name: gitUser.name,
            email: gitUser.email,
            isVirtual: true
        };
    } catch (e) {
        return null;
    }
}

export async function createUser(username: string, gitUser: GitUser, profilePicUrl?: string): Promise<void> {
    const userDir = path.join(USERS_DIR, username);
    await fs.mkdir(userDir, { recursive: true });
    
    const info = {
        name: gitUser.name,
        email: gitUser.email,
    };
    
    const infoPath = path.join(userDir, 'meta.yaml');
    await fs.writeFile(infoPath, yaml.dump(info));
    
    try {
        await execa('git', ['add', infoPath]);
    } catch (e) {
        // Ignore git add errors (e.g. if not in a git repo, though getGitConfig would have failed)
    }

    if (profilePicUrl) {
        await saveProfilePic(username, profilePicUrl);
    }
}

export async function saveExternalMetadata(
    username: string,
    importInfo: { src: string; at: string; dit_version: string; external_id?: string }
): Promise<void> {
    const userDir = path.join(USERS_DIR, username);
    await fs.mkdir(userDir, { recursive: true });

    const metaPath = path.join(userDir, 'meta.yaml');
    let meta: any = {};
    try {
        const content = await fs.readFile(metaPath, 'utf8');
        meta = (yaml.load(content) as any) || {};
    } catch (e) {
        // Ignore missing meta.yaml
    }

    meta.import = importInfo;
    if (importInfo.external_id) {
        meta.external_id = importInfo.external_id;
    }

    await fs.writeFile(metaPath, yaml.dump(meta));

    try {
        await execa('git', ['add', metaPath]);
    } catch (e) {
        // Ignore
    }
}

export async function saveProfilePic(username: string, url: string): Promise<void> {
    const userDir = path.join(USERS_DIR, username);
    await fs.mkdir(userDir, { recursive: true });

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch profile pic: ${response.statusText}`);
        
        const contentType = response.headers.get('content-type');
        let ext = 'png';
        if (contentType) {
            if (contentType.includes('jpeg')) ext = 'jpg';
            else if (contentType.includes('webp')) ext = 'webp';
            else if (contentType.includes('png')) ext = 'png';
            else if (contentType.includes('gif')) ext = 'gif';
        }

        const buffer = await response.arrayBuffer();
        const filename = `avatar.${ext}`;
        const filePath = path.join(userDir, filename);

        // Remove old avatars
        const possiblePics = ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp', 'avatar.gif'];
        for (const pic of possiblePics) {
            try {
                await fs.unlink(path.join(userDir, pic));
            } catch {}
        }

        await fs.writeFile(filePath, Buffer.from(buffer));
        
        try {
            await execa('git', ['add', filePath]);
        } catch (e) {
            // Ignore
        }
    } catch (e) {
        console.error(`Failed to save profile pic for ${username}:`, e);
    }
}

export async function saveProfilePicData(username: string, buffer: Buffer, contentType?: string): Promise<void> {
    const userDir = path.join(USERS_DIR, username);
    await fs.mkdir(userDir, { recursive: true });

    let ext = 'png';
    if (contentType) {
        if (contentType.includes('jpeg')) ext = 'jpg';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('gif')) ext = 'gif';
    }

    const filename = `avatar.${ext}`;
    const filePath = path.join(userDir, filename);

    // Remove old avatars
    const possiblePics = ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp', 'avatar.gif'];
    for (const pic of possiblePics) {
        try {
            await fs.unlink(path.join(userDir, pic));
        } catch {}
    }

    await fs.writeFile(filePath, buffer);
    
    try {
        await execa('git', ['add', filePath]);
    } catch (e) {
        // Ignore
    }
}

export async function deleteProfilePic(username: string): Promise<void> {
    const userDir = path.join(USERS_DIR, username);
    const possiblePics = ['avatar.png', 'avatar.jpg', 'avatar.jpeg', 'avatar.webp', 'avatar.gif'];
    for (const pic of possiblePics) {
        const filePath = path.join(userDir, pic);
        try {
            await fs.unlink(filePath);
            try {
                await execa('git', ['rm', filePath]);
            } catch {}
        } catch {}
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
