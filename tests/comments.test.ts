import { threadComments, Comment } from '../src/utils/comments.js';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function runTests() {
    console.log('Running comments tests...');

    // Test case 1: Flat comments
    const flatComments: Comment[] = [
        { id: '1', author: 'A', date: '2023-01-01T00:00:00Z', body: 'First' },
        { id: '2', author: 'B', date: '2023-01-02T00:00:00Z', body: 'Second' },
    ];
    const threaded1 = threadComments(flatComments);
    assert(threaded1.length === 2, 'Should have 2 threaded comments');
    assert(threaded1[0].id === '1', 'First should be id 1');
    assert(threaded1[0].depth === 0, 'First should have depth 0');
    assert(threaded1[1].id === '2', 'Second should be id 2');
    assert(threaded1[1].depth === 0, 'Second should have depth 0');

    // Test case 2: Simple threading
    const threadedComments: Comment[] = [
        { id: '1', author: 'A', date: '2023-01-01T00:00:00Z', body: 'First' },
        { id: '2', author: 'B', date: '2023-01-02T00:00:00Z', body: 'Reply to First', reply_to: '1' },
    ];
    const threaded2 = threadComments(threadedComments);
    assert(threaded2.length === 2, 'Should have 2 threaded comments in flattened list');
    assert(threaded2[0].id === '1', 'Root should be id 1');
    assert(threaded2[0].depth === 0, 'Root should have depth 0');
    assert(threaded2[1].id === '2', 'Reply should be id 2');
    assert(threaded2[1].depth === 1, 'Reply should have depth 1');

    // Test case 3: Complex threading and sorting
    const complexComments: Comment[] = [
        { id: '2', author: 'B', date: '2023-01-02T00:00:00Z', body: 'Reply to 1', reply_to: '1' },
        { id: '1', author: 'A', date: '2023-01-01T00:00:00Z', body: 'Root' },
        { id: '3', author: 'C', date: '2023-01-03T00:00:00Z', body: 'Reply to 2', reply_to: '2' },
        { id: '4', author: 'D', date: '2023-01-01T12:00:00Z', body: 'Another root' },
    ];
    const threaded3 = threadComments(complexComments);
    // Order should be: 1, 2, 3, 4 (since 1 < 4 and 2, 3 are children of 1)
    assert(threaded3.length === 4, 'Should have 4 comments');
    assert(threaded3[0].id === '1', 'Index 0 should be id 1');
    assert(threaded3[0].depth === 0, 'Index 0 depth 0');
    assert(threaded3[1].id === '2', 'Index 1 should be id 2');
    assert(threaded3[1].depth === 1, 'Index 1 depth 1');
    assert(threaded3[2].id === '3', 'Index 2 should be id 3');
    assert(threaded3[2].depth === 2, 'Index 2 depth 2');
    assert(threaded3[3].id === '4', 'Index 3 should be id 4');
    assert(threaded3[3].depth === 0, 'Index 3 depth 0');

    console.log('Comments tests passed!');
}

try {
    runTests();
} catch (error) {
    console.error('Comments tests failed:', error);
    process.exit(1);
}
