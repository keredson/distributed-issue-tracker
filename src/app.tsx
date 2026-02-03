import React from 'react';
import {Text, useApp, Box} from 'ink';
import TextInput from 'ink-text-input';
import NewIssue from './commands/NewIssue.js';
import NewTemplate from './commands/NewTemplate.js';
import IssueList from './commands/IssueList.js';
import IssueView from './commands/IssueView.js';
import IssueEdit from './commands/IssueEdit.js';
import IssueComment from './commands/IssueComment.js';
import InteractiveDashboard from './commands/InteractiveDashboard.js';
import Import from './commands/Import.js';
import Web from './commands/Web.js';
import WebPasskey from './commands/WebPasskey.js';
import { getGitConfig, getLocalUsers, createUser, GitUser } from './utils/user.js';

type Props = {
	command?: string;
    input: string[];
	flags: any;
	showHelp: () => void;
};

function StandaloneEdit({id}: {id: string}) {
    const {exit} = useApp();
    return <IssueEdit id={id} onBack={() => exit()} />;
}

function StandaloneComment({id}: {id: string}) {
    const {exit} = useApp();
    return <IssueComment id={id} onBack={() => exit()} />;
}

function UserOnboarding({ onComplete }: { onComplete: () => void }) {
    const [step, setStep] = React.useState<'checking' | 'prompt' | 'creating'>('checking');
    const [gitUser, setGitUser] = React.useState<GitUser | null>(null);
    const [username, setUsername] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const check = async () => {
            try {
                const user = await getGitConfig();
                setGitUser(user);
                
                const localUsers = await getLocalUsers();
                const exists = localUsers.find(u => u.email === user.email);

                if (exists) {
                    onComplete();
                } else {
                    const defaultUser = user.email.split('@')[0] || user.name.replace(/\s+/g, '').toLowerCase();
                    setUsername(defaultUser);
                    setStep('prompt');
                }
            } catch (e: any) {
                setError(e.message);
            }
        };
        check();
    }, []);

    const handleSubmit = async () => {
        if (!gitUser || !username) return;
        setStep('creating');
        try {
            await createUser(username, gitUser);
            onComplete();
        } catch (e: any) {
            setError(e.message);
            setStep('prompt');
        }
    };

    if (error) return <Text color="red">Error: {error}</Text>;
    if (step === 'checking') return null;
    if (step === 'creating') return <Text>Creating user profile...</Text>;

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
            <Text>Welcome to dit!</Text>
            <Text>No local user profile found for {gitUser?.name} ({gitUser?.email}).</Text>
            <Text>Please enter a username to create your profile:</Text>
            <Box marginTop={1}>
                <Text color="green">❯ </Text>
                <TextInput value={username} onChange={setUsername} onSubmit={handleSubmit} />
            </Box>
        </Box>
    );
}

export default function App({command, input, flags, showHelp}: Props) {
    const [userVerified, setUserVerified] = React.useState(false);

	if (flags.help) {
		if (command === 'new') {
			return (
				<Text>
					{`Usage\n  $ dit new [issue|template]\n\nSubcommands\n  issue     Create a new issue (default)\n  template  Create a new issue template\n\nOptions\n  --skip-add  Skip automatic 'git add' of the new issue files`}
				</Text>
			);
		}
		if (command === 'ls') {
			return (
				<Text>
					{`Usage\n  $ dit ls\n\nOptions\n  --all       Show all issues (default)\n  --author    Filter by author (TODO)`}
				</Text>
			);
		}
        if (command === 'view') {
            return (
                <Text>
                    {`Usage\n  $ dit view <id>\n\nView details of an issue.`}
                </Text>
            );
        }
        if (command === 'edit') {
            return (
                <Text>
                    {`Usage\n  $ dit edit <id>\n\nEdit an issue.`}
                </Text>
            );
        }
        if (command === 'comment') {
            return (
                <Text>
                    {`Usage\n  $ dit comment <id>\n\nAdd a comment to an issue.`}
                </Text>
            );
        }
        if (command === 'import') {
            return (
                <Text>
                    {`Usage\n  $ dit import [url]\n\nImport issues from a GitHub repository.\n\nOptions\n  --skip-add  Skip automatic 'git add' of the imported issue files`}
                </Text>
            );
        }
        if (command === 'web') {
            return (
                <Text>
                    {`Usage\n  $ dit web [passkey]\n\nLaunch the web interface or create a passkey.`}
                </Text>
            );
        }
		showHelp();
		return null;
	}

    if (!userVerified) {
        return <UserOnboarding onComplete={() => setUserVerified(true)} />;
    }

    if (!command) {
        return <InteractiveDashboard flags={flags} />;
    }

	if (command === 'new') {
        const subCommand = input[1];
        if (subCommand === 'template') {
            return <NewTemplate />;
        }
        // Default to issue if 'issue' is specified or if no subcommand is provided
        return <NewIssue skipAdd={flags.skipAdd} />;
	}

	if (command === 'ls') {
		return <IssueList flags={flags} />;
	}

    if (command === 'view') {
        const id = input[1];
        return <IssueView id={id} />;
    }

    if (command === 'edit') {
        const id = input[1];
        if (!id) return <Text color="red">Error: No issue ID provided for edit command.</Text>;
        return <StandaloneEdit id={id} />;
    }

    if (command === 'comment') {
        const id = input[1];
        if (!id) return <Text color="red">Error: No issue ID provided for comment command.</Text>;
        return <StandaloneComment id={id} />;
    }

    if (command === 'import') {
        const url = input[1];
        return <Import url={url} skipAdd={flags.skipAdd} />;
    }

    if (command === 'web') {
        if (input[1] === 'passkey') {
            return <WebPasskey />;
        }
        return <Web />;
    }

	return <Text>Unknown command: {command || 'none'}</Text>;
}