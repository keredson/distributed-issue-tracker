import { getAllIssues, saveIssue, saveComment, getCommentsForIssue } from '../src/utils/issues.js';
import fs from 'node:fs';
import path from 'node:path';
import { generateUniqueId } from '../src/utils/id.js';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runTests() {
    console.log('Running issues comments tests...');
    
    const testDir = path.join('.dit', 'test-issues-comments');
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    try {
        // Create an issue
        const issueId = generateUniqueId();
        const issueMeta = {
            id: issueId,
            title: 'Test Issue',
            description: 'Test Description',
            author: 'Tester',
            created: new Date().toISOString(),
            status: 'open'
        };
        
        const issuePath = await saveIssue(issueMeta, true, testDir);
        
        // Initial check - should have 0 comments
        let issues = await getAllIssues(testDir);
        const savedIssue = issues.find((i: any) => i.id === issueId);
        assert(savedIssue !== undefined, 'Issue should be found');
        
        assert(savedIssue.comments_count === 0, 'Initial comments count should be 0');
        
        // Add a comment
        const commentId = generateUniqueId();
        const commentData = {
            id: commentId,
            author: 'Commenter',
            body: 'This is a comment',
            created: new Date().toISOString()
        };
        
        await saveComment(issuePath, commentData, true);
        
        // Check comments count
        issues = await getAllIssues(testDir);
        const updatedIssue = issues.find((i: any) => i.id === issueId);
        
        assert(updatedIssue.comments_count === 1, `Expected comments_count to be 1, but got ${updatedIssue.comments_count}`);

        // Test dynamic nesting when threshold exceeded
        const commentsBaseDir = path.join(issuePath, 'comments');
        // Pre-fill threshold
        if (!fs.existsSync(commentsBaseDir)) fs.mkdirSync(commentsBaseDir, { recursive: true });
        for (let i = 0; i < 128; i++) {
            fs.mkdirSync(path.join(commentsBaseDir, `fill-${i}`));
        }

        const nestedCommentData = {
            id: 'nested-123',
            author: 'Nester',
            body: 'Nested comment',
            created: '2026-02-02T12:00:00Z'
        };
        await saveComment(issuePath, nestedCommentData, true);
        
        const expectedNestedPath = path.join(commentsBaseDir, '2026', `nested-comment-nested-123.yaml`);
        assert(fs.existsSync(expectedNestedPath), `Nested comment should be found in date-based directory: ${expectedNestedPath}`);

        // Test recursive loading
        const allComments = getCommentsForIssue(issuePath);
        assert(allComments.length === 2, `Should find 2 actual comments, but got ${allComments.length}`);
        assert(allComments.some((c: any) => c.id === 'nested-123'), 'Should find the nested comment');

        // Test Date Normalization
        console.log('Testing date normalization...');
        const legacyCommentData = {
            id: generateUniqueId(),
            author: 'Legacy User',
            body: 'Legacy comment with created only',
            created: new Date().toISOString()
        };
        // Save without 'date' field
        await saveComment(issuePath, legacyCommentData, true);
        
        const commentsAfterLegacy = getCommentsForIssue(issuePath);
        const legacyComment = commentsAfterLegacy.find((c: any) => c.id === legacyCommentData.id);
        
        assert(legacyComment !== undefined, 'Legacy comment should be found');
        assert(legacyComment.date !== undefined, 'Legacy comment should have normalized date field');
        assert(legacyComment.date === legacyCommentData.created, 'Normalized date should match created date');
        console.log('Date normalization passed!');

        // Cleanup
        fs.rmSync(testDir, { recursive: true, force: true });

        console.log('Issues comments tests passed!');
    } catch (error) {
        console.error('Issues comments tests failed:', error);
        // Cleanup even on failure
        if (fs.existsSync(testDir)) {
             fs.rmSync(testDir, { recursive: true, force: true });
        }
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Unhandled error in runTests:', err);
    process.exit(1);
});