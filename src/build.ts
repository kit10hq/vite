import nodePath from 'node:path';
import { build, createServer } from 'vite';
import * as buildOptions from './build/options.js';
import { getRoutes } from './build/router/file-tree.js';

if (buildOptions.is_prod) {
	// throw new Error('Cannot build in production mode.');
	const input: Record<string, string> = {};
	for (const route_data of getRoutes()) {
		const name = nodePath
			.relative(buildOptions.source_path, route_data.file.path)
			.replace(/\+page\.[a-z\d]+/u, '')
			.replaceAll('/', '_')
			.replaceAll('[', '(')
			.replaceAll(']', ')');
		input[name] = route_data.file.path;
	}

	await build({
		root: buildOptions.source_path,
		configFile: false,
		appType: 'custom',
		build: {
			outDir: buildOptions.output_path,
			emptyOutDir: true,
			manifest: true,
			rolldownOptions: {
				input,
				output: {
					assetFileNames: 'assets/[name]-[hash][extname]',
					chunkFileNames: 'assets/chunks/[name]-[hash].js',
					entryFileNames: 'assets/[name]-[hash].js',
				},
			},
		},
	});
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
