import { getAllIssues, saveIssue, saveComment } from '../src/utils/issues.js';
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
        
        // This is the bug: comments_count is likely undefined or 0
        console.log('Comments count (initial):', savedIssue.comments_count);
        // We expect this to fail initially if the bug exists and we assert it to be 0 (if undefined) or simply verify it's missing
        
        // Add a comment
        const commentData = {
            id: generateUniqueId(),
            author: 'Commenter',
            body: 'This is a comment',
            created: new Date().toISOString()
        };
        
        await saveComment(issuePath, commentData, true);
        
        // Check comments count
        issues = await getAllIssues(testDir);
        const updatedIssue = issues.find((i: any) => i.id === issueId);
        
        console.log('Comments count (after comment):', updatedIssue.comments_count);
        
        assert(updatedIssue.comments_count === 1, `Expected comments_count to be 1, but got ${updatedIssue.comments_count}`);

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
        
        const { getCommentsForIssue } = await import('../src/utils/issues.js');
        const comments = getCommentsForIssue(issuePath);
        const legacyComment = comments.find((c: any) => c.id === legacyCommentData.id);
        
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

runTests();
