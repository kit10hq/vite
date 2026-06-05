#!/usr/bin/env node

// oxlint-disable unicorn/no-process-exit

const command: string | undefined = process.argv[2];
if (command === 'dev' || command === 'build') {
	await import('./build.js');
} else {
	process.stderr.write(
		`Unknown command "${command ?? ''}". Use "dev" or "build".\n`,
	);
	process.exit(1);
}
