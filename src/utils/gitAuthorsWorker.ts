import { parentPort } from 'node:worker_threads';
import { execa } from 'execa';

async function fetchAuthors() {
    try {
        // use shortlog for efficiency: summary, email, numbered (sorted by count)
        const { stdout } = await execa('git', ['shortlog', '-sen', '--all', '--no-merges']);
        
        // Parse output: "   123  Name <email>"
        const authors = stdout
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const match = line.match(/^\s*\d+\s+(.+)$/);
                return match ? match[1] : null;
            })
            .filter((author): author is string => author !== null);

        if (parentPort) {
            parentPort.postMessage({ type: 'success', authors });
        }
    } catch (error: any) {
        if (parentPort) {
            parentPort.postMessage({ type: 'error', error: error.message });
        }
    }
}

fetchAuthors();
