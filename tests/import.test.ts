import { saveIssue, findIssueByExternalId, saveComment, findCommentByExternalId } from '../src/utils/issues.js';
import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runTests() {
    console.log('Running import utility tests...');
    
    const testDir = path.join('.dit', 'test-import-issues');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    try {
        // Test saveIssue and findIssueByExternalId
        const externalId = 'github:owner/repo#1';
        const issueData = {
            id: 'test-id-1',
            external_id: externalId,
            title: 'Test Issue',
            created: new Date().toISOString(),
            status: 'open',
            body: 'Test body'
        };

        const issuePath = await saveIssue(issueData, true, testDir);
        assert(fs.existsSync(issuePath), 'Issue directory should be created');
        assert(fs.existsSync(path.join(issuePath, 'meta.yaml')), 'meta.yaml should be created');
        assert(fs.existsSync(path.join(issuePath, 'description.md')), 'description.md should be created');

        const foundPath = findIssueByExternalId(externalId, testDir);
        assert(foundPath === issuePath, 'Should find issue by external ID');

        const notFoundPath = findIssueByExternalId('nonexistent', testDir);
        assert(notFoundPath === null, 'Should not find nonexistent external ID');

        // Test saveComment and findCommentByExternalId
        const commentExternalId = 'github:comment:123';
        const commentData = {
            id: 'comment-id-1',
            external_id: commentExternalId,
            author: 'test-user',
            date: new Date().toISOString(),
            body: 'Test comment body'
        };

        const commentPath = await saveComment(issuePath, commentData, true);
        assert(fs.existsSync(commentPath), 'Comment file should be created');

        const foundCommentPath = findCommentByExternalId(issuePath, commentExternalId);
        assert(foundCommentPath === commentPath, 'Should find comment by external ID');

        const notFoundCommentPath = findCommentByExternalId(issuePath, 'nonexistent-comment');
        assert(notFoundCommentPath === null, 'Should not find nonexistent comment external ID');

        // Cleanup
        fs.rmSync(testDir, { recursive: true, force: true });

        console.log('Import utility tests passed!');
    } catch (error) {
        console.error('Import utility tests failed:', error);
        process.exit(1);
    }
}

runTests();
