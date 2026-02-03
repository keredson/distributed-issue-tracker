import { saveIssue, getAllIssues, getIssueById } from '../src/utils/issues.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runTests() {
    console.log('Running tags tests...');
    
    const testIssuesDir = path.join(process.cwd(), '.dit', 'test-tags-issues');
    if (fs.existsSync(testIssuesDir)) {
        console.log('Cleaning up existing test dir...');
        fs.rmSync(testIssuesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testIssuesDir, { recursive: true });

    try {
        const issueData = {
            id: 'tagtest1',
            title: 'Test Issue with Tags',
            body: 'This is a test issue',
            created: new Date().toISOString(),
            status: 'open',
            severity: 'medium',
            assignee: '',
            author: 'testuser',
            tags: ['bug', 'ui', 'high-priority']
        };

        console.log('Saving issue with tags...');
        await saveIssue(issueData, true, testIssuesDir);
        
        console.log('Verifying getAllIssues...');
        const issues = await getAllIssues(testIssuesDir);
        assert(issues.length === 1, 'Should have 1 issue');
        assert(Array.isArray(issues[0].tags), 'Tags should be an array');
        assert(issues[0].tags.length === 3, 'Should have 3 tags');
        assert(issues[0].tags.includes('bug'), 'Should include "bug" tag');
        assert(issues[0].tags.includes('ui'), 'Should include "ui" tag');
        assert(issues[0].tags.includes('high-priority'), 'Should include "high-priority" tag');

        console.log('Verifying getIssueById...');
        const issue = await getIssueById(testIssuesDir, 'tagtest1');
        assert(issue !== null, 'Issue should be found');
        assert(Array.isArray(issue.tags), 'Tags should be an array in getIssueById');
        assert(issue.tags.length === 3, 'Should have 3 tags in getIssueById');

        console.log('Testing updating tags...');
        const updatedData = {
            ...issueData,
            tags: ['bug', 'fixed']
        };
        
        const issuePath = path.join(testIssuesDir, issues[0].dir, 'issue.yaml');
        fs.writeFileSync(issuePath, yaml.dump(updatedData));
        
        const updatedIssue = await getIssueById(testIssuesDir, 'tagtest1');
        assert(updatedIssue.tags.length === 2, 'Should have 2 tags after update');
        assert(updatedIssue.tags.includes('fixed'), 'Should include "fixed" tag');
        assert(!updatedIssue.tags.includes('ui'), 'Should not include "ui" tag');

        console.log('Tags tests passed!');
    } catch (error: any) {
        console.error('Tags tests failed:', error);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        if (fs.existsSync(testIssuesDir)) fs.rmSync(testIssuesDir, { recursive: true, force: true });
    }
}

runTests();
