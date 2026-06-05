import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import nodePath from 'node:path';
import { build, createServer, type Plugin, type ViteDevServer } from 'vite';
import * as buildOptions from './build/options.js';
import { getRoutes } from './build/router/file-tree.js';

if (buildOptions.is_prod) {
	throw new Error('Cannot build in production mode.');
	// await build({
	// 	root: buildOptions.source_path,
	// 	configFile: false,
	// 	appType: 'custom',
	// 	build: {
	// 		outDir: buildOptions.output_path,
	// 		emptyOutDir: true,
	// 		manifest: true,
	// 		rolldownOptions: {
	// 			input: createHtmlInputs(),
	// 		},
	// 	},
	// });
} else {
	const { routePlugin } = await import('./build/plugins/route.js');
	const server = await createServer({
		root: buildOptions.source_path,
		configFile: false,
		appType: 'custom',
		plugins: [routePlugin()],
		server: {
			port: buildOptions.config.server?.port,
		},
	});

	await server.listen();
	server.printUrls();
}
