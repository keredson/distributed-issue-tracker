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
    console.log('Running labels tests...');
    
    const testIssuesDir = path.join(process.cwd(), '.dit', 'test-labels-issues');
    if (fs.existsSync(testIssuesDir)) {
        console.log('Cleaning up existing test dir...');
        fs.rmSync(testIssuesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testIssuesDir, { recursive: true });

    try {
        const issueData = {
            id: 'labeltest1',
            title: 'Test Issue with Labels',
            body: 'This is a test issue',
            created: new Date().toISOString(),
            status: 'open',
            severity: 'medium',
            assignee: '',
            author: 'testuser',
            labels: ['bug', 'ui', 'high-priority']
        };

        console.log('Saving issue with labels...');
        await saveIssue(issueData, true, testIssuesDir);
        
        console.log('Verifying getAllIssues...');
        const issues = await getAllIssues(testIssuesDir);
        assert(issues.length === 1, 'Should have 1 issue');
        assert(Array.isArray(issues[0].labels), 'Labels should be an array');
        assert(issues[0].labels.length === 3, 'Should have 3 labels');
        assert(issues[0].labels.includes('bug'), 'Should include "bug" label');
        assert(issues[0].labels.includes('ui'), 'Should include "ui" label');
        assert(issues[0].labels.includes('high-priority'), 'Should include "high-priority" label');

        console.log('Verifying getIssueById...');
        const issue = await getIssueById(testIssuesDir, 'labeltest1');
        assert(issue !== null, 'Issue should be found');
        assert(Array.isArray(issue.labels), 'Labels should be an array in getIssueById');
        assert(issue.labels.length === 3, 'Should have 3 labels in getIssueById');

        console.log('Testing updating labels...');
        const updatedData = {
            ...issueData,
            labels: ['bug', 'fixed']
        };
        
        const issuePath = path.join(testIssuesDir, issues[0].dir, 'meta.yaml');
        const { body: _body, ...metaOnly } = updatedData;
        fs.writeFileSync(issuePath, yaml.dump(metaOnly));
        
        const updatedIssue = await getIssueById(testIssuesDir, 'labeltest1');
        assert(updatedIssue.labels.length === 2, 'Should have 2 labels after update');
        assert(updatedIssue.labels.includes('fixed'), 'Should include "fixed" label');
        assert(!updatedIssue.labels.includes('ui'), 'Should not include "ui" label');

        console.log('Labels tests passed!');
    } catch (error: any) {
        console.error('Labels tests failed:', error);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        if (fs.existsSync(testIssuesDir)) fs.rmSync(testIssuesDir, { recursive: true, force: true });
    }
}

runTests();
