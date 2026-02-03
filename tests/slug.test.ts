import { generateSlug } from '../src/utils/slug.js';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function runTests() {
    console.log('Running slug tests...');

    // Test case 1: Basic slug
    assert(generateSlug('Hello World') === 'hello-world', 'Basic slug failed');

    // Test case 2: Special characters
    assert(generateSlug('Hello! @World #2023') === 'hello-world-2023', 'Special characters failed');

    // Test case 3: Max length
    const longTitle = 'This is a very long title that should be truncated eventually because it is way too long for a directory name';
    const slug = generateSlug(longTitle, 20);
    assert(slug.length <= 20, 'Slug too long');
    assert(slug === 'this-is-a-very-long', 'Truncation failed');

    // Test case 3b: Default max length (32)
    const slug32 = generateSlug(longTitle);
    assert(slug32.length <= 32, 'Default slug too long');
    assert(slug32 === 'this-is-a-very-long-title-that-s', 'Default truncation failed');

    // Test case 4: Truncate trailing dashes
    assert(generateSlug('Hello World-----', 12) === 'hello-world', 'Trailing dashes truncation failed');

    // Test case 5: Empty/Invalid input
    assert(generateSlug('') === 'untitled', 'Empty input failed');

    console.log('Slug tests passed!');
}

try {
    runTests();
} catch (error) {
    console.error('Slug tests failed:', error);
    process.exit(1);
}
