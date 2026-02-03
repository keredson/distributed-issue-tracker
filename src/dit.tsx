#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(`
	Usage
	  $ dit <command>

	Commands
	  new [issue|template] Create a new issue (default) or template
	  ls                   List issues
	  view      View an issue
	  edit      Edit an issue
	  comment   Add a comment to an issue
	  import    Import issues from GitHub
	  web       Launch the web interface (subcommand: passkey)

	For more details on a specific command, run:
	  $ dit <command> --help
`, {
	importMeta: import.meta,
	flags: {
		skipAdd: {
			type: 'boolean',
			default: false,
		},
		all: {
			type: 'boolean',
			default: false,
		},
		verbose: {
			type: 'boolean',
			default: false,
			shortFlag: 'v'
		}
	},
});

render(<App command={cli.input[0]} input={cli.input} flags={cli.flags} showHelp={cli.showHelp} />);
