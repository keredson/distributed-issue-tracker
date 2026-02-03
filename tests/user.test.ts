import { createUser, getLocalUsers, saveExternalMetadata } from '../src/utils/user.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

const USERS_DIR = '.dit/users';

async function runTests() {
    console.log('Running user utility tests...');
    
    const testUsername = 'testuser-' + Math.random().toString(36).substring(7);
    const userDir = path.join(USERS_DIR, testUsername);

    try {
        // Test createUser
        const gitUser = { name: 'Test User', email: 'test@example.com' };
        await createUser(testUsername, gitUser);
        
        assert(await fs.access(userDir).then(() => true).catch(() => false), 'User directory should be created');
        const infoContent = await fs.readFile(path.join(userDir, 'info.yaml'), 'utf8');
        const info = yaml.load(infoContent) as any;
        assert(info.name === 'Test User', 'Name should match');
        assert(info.email === 'test@example.com', 'Email should match');

        // Test createUser without email
        const noEmailUsername = 'noemail-' + Math.random().toString(36).substring(7);
        await createUser(noEmailUsername, { name: 'No Email User' });
        const noEmailDir = path.join(USERS_DIR, noEmailUsername);
        assert(await fs.access(noEmailDir).then(() => true).catch(() => false), 'No-email user directory should be created');
        const noEmailInfoContent = await fs.readFile(path.join(noEmailDir, 'info.yaml'), 'utf8');
        const noEmailInfo = yaml.load(noEmailInfoContent) as any;
        assert(noEmailInfo.name === 'No Email User', 'Name should match');
        assert(noEmailInfo.email === undefined, 'Email should be undefined');
        await fs.rm(noEmailDir, { recursive: true, force: true });

        // Test saveExternalMetadata
        const githubData = {
            login: testUsername,
            id: 12345,
            bio: 'Hello world',
            public_repos: 10
        };
        
        await saveExternalMetadata(testUsername, 'github', githubData);
        
        const githubYamlPath = path.join(userDir, 'github.yaml');
        assert(await fs.access(githubYamlPath).then(() => true).catch(() => false), 'github.yaml should be created');
        
        const githubContent = await fs.readFile(githubYamlPath, 'utf8');
        const savedData = yaml.load(githubContent) as any;
        assert(savedData.login === testUsername, 'Saved github login should match');
        assert(savedData.bio === 'Hello world', 'Saved github bio should match');
        assert(savedData.public_repos === 10, 'Saved github public_repos should match');

        // Test getLocalUsers loads github metadata
        const users = await getLocalUsers();
        const testUser = users.find(u => u.username === testUsername);
        assert(!!testUser, 'User should be found in getLocalUsers');
        assert(!!testUser?.github, 'User should have github metadata');
        assert(testUser?.github.login === testUsername, 'Loaded github login should match');
        assert(testUser?.github.bio === 'Hello world', 'Loaded github bio should match');

        console.log('User utility tests passed!');
    } catch (error) {
        console.error('User utility tests failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
        try {
            await fs.rm(userDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

runTests();
