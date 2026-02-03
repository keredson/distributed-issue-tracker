import { getAllExistingIds, generateUniqueId } from '../src/utils/id.js';
import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runTest() {
    console.log('Running ID tests...');
    const testIssuesDir = path.join('.dit', 'test-ids-issues');
    if (!fs.existsSync(testIssuesDir)) {
        fs.mkdirSync(testIssuesDir, { recursive: true });
    }

    const testNestedDir = path.join(testIssuesDir, '2026', '02');
    if (!fs.existsSync(testNestedDir)) {
        fs.mkdirSync(testNestedDir, { recursive: true });
    }

    const testIssueDir = path.join(testNestedDir, 'test-issue-1234567');
    const issueYamlPath = path.join(testIssueDir, 'issue.yaml');
    const commentYamlPath = path.join(testIssueDir, 'comment-test-abcdefg.yaml');

    try {
        if (!fs.existsSync(testIssueDir)) {
            fs.mkdirSync(testIssueDir, { recursive: true });
        }
        fs.writeFileSync(issueYamlPath, `id: "1234567"
title: Test Issue`);
        fs.writeFileSync(commentYamlPath, `id: "abcdefg"
body: Test Comment`);

        const existing = getAllExistingIds(testIssuesDir);
        
        assert(existing.has('1234567'), 'Failed to find existing issue ID in nested dir');
        assert(existing.has('abcdefg'), 'Failed to find existing comment ID in nested dir');

        const newId = generateUniqueId(testIssuesDir);
        assert(newId.length === 7, 'Generated ID should have length 7');
        assert(!existing.has(newId), 'Generated ID already exists!');

        // Test with multiple issues and comments in different nested dirs
        const testNestedDir2 = path.join(testIssuesDir, '2025', '12');
        if (!fs.existsSync(testNestedDir2)) fs.mkdirSync(testNestedDir2, { recursive: true });
        
        const testIssueDir2 = path.join(testNestedDir2, 'test-issue-7654321');
        if (!fs.existsSync(testIssueDir2)) fs.mkdirSync(testIssueDir2, { recursive: true });
        fs.writeFileSync(path.join(testIssueDir2, 'issue.yaml'), 'id: "7654321"\ntitle: Another');
        fs.writeFileSync(path.join(testIssueDir2, 'comment-x-y123456.yaml'), 'id: "y123456"\nbody: Hi');

        const existing2 = getAllExistingIds(testIssuesDir);
        assert(existing2.has('7654321'), 'Failed to find second issue ID in different nested dir');
        assert(existing2.has('y123456'), 'Failed to find second comment ID in different nested dir');

        console.log('ID tests passed!');
    } catch (error) {
        console.error('ID tests failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
        if (fs.existsSync(testIssuesDir)) {
            fs.rmSync(testIssuesDir, { recursive: true, force: true });
        }
    }
}

runTest();
