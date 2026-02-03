import { findIssueDirById, getIssueTargetDir } from '../src/utils/issues.js';
import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function runTests() {
    console.log('Running issues tests...');
    
    const testDir = path.join('.dit', 'test-issues');
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });

    try {
        // Test Case: getIssueTargetDir with empty directory
        const date = '2026-02-02T12:00:00Z';
        assert(getIssueTargetDir(testDir, date) === testDir, 'Should return base dir when empty');

        // Test Case: getIssueTargetDir with many entries (simulated)
        // We can't easily create 128 directories quickly in a test without making it slow, 
        // but we can try with a smaller threshold if we could, but it's hardcoded.
        // Let's at least test that it returns the base dir when < 128.
        for (let i = 0; i < 10; i++) {
            fs.mkdirSync(path.join(testDir, `issue-${i}`));
        }
        assert(getIssueTargetDir(testDir, date) === testDir, 'Should still return base dir with 10 entries');

        // To test threshold, we can temporarily create 120 more
        for (let i = 10; i < 128; i++) {
            fs.mkdirSync(path.join(testDir, `issue-${i}`));
        }
        // Now it should return year
        assert(getIssueTargetDir(testDir, date) === path.join(testDir, '2026'), 'Should return year dir when base is full');
        
        // Create year dir and fill it
        const yearDir = path.join(testDir, '2026');
        if (!fs.existsSync(yearDir)) fs.mkdirSync(yearDir);
        for (let i = 0; i < 128; i++) {
            fs.mkdirSync(path.join(yearDir, `issue-in-year-${i}`));
        }
        // Now it should return month
        assert(getIssueTargetDir(testDir, date) === path.join(yearDir, '02'), 'Should return month dir when year is full');

        // Test findIssueDirById with nested directory
        const nestedDir = path.join(testDir, '2026', '02');
        const issueDir = path.join(nestedDir, 'my-cool-issue-12345');
        if (!fs.existsSync(issueDir)) fs.mkdirSync(issueDir, { recursive: true });
        fs.writeFileSync(path.join(issueDir, 'issue.yaml'), 'id: 12345');
        
        assert(findIssueDirById(testDir, '12345') === path.join('2026', '02', 'my-cool-issue-12345'), 'Should find issue by ID in nested directory');

        // Test case 2: Issue not found
        assert(findIssueDirById(testDir, 'nonexistent') === null, 'Should return null for nonexistent ID');

        // Test case 3: Multiple issues in different nested directories
        const nestedDir2 = path.join(testDir, '2025', '12');
        const issueDir2 = path.join(nestedDir2, 'another-issue-67890');
        if (!fs.existsSync(issueDir2)) fs.mkdirSync(issueDir2, { recursive: true });
        fs.writeFileSync(path.join(issueDir2, 'issue.yaml'), 'id: 67890');
        
        assert(findIssueDirById(testDir, '67890') === path.join('2025', '12', 'another-issue-67890'), 'Should find second issue in different nested directory');
        assert(findIssueDirById(testDir, '12345') === path.join('2026', '02', 'my-cool-issue-12345'), 'Should still find first issue');

        // Cleanup
        fs.rmSync(testDir, { recursive: true, force: true });

        console.log('Issues tests passed!');
    } catch (error) {
        console.error('Issues tests failed:', error);
        process.exit(1);
    }
}

runTests();
