import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { build, createServer } from 'vite';
import * as buildOptions from './build/options.js';
import { getRoutes } from './build/router/file-tree.js';
import {
	readTemplate,
	splitTemplate,
	startsWithHtmlElement,
	TEMPLATE_PATH_ABSOLUTE,
} from './build/template.js';

if (buildOptions.is_prod) {
	// throw new Error('Cannot build in production mode.');

	const routes = getRoutes();
	const input: Record<string, string> = {};
	for (const route_data of routes) {
		const name = nodePath
			.relative(buildOptions.source_path, route_data.file.path)
			.replace(/\+page\.[a-z\d]+/u, '')
			.replaceAll('/', '_')
			.replaceAll('[', '(')
			.replaceAll(']', ')');
		input[name] = route_data.file.path;
	}

	const template_html = await readTemplate();
	if (template_html !== null) {
		input.__template = TEMPLATE_PATH_ABSOLUTE;
	}

	await build({
		root: buildOptions.source_path,
		configFile: false,
		appType: 'custom',
		plugins: [],
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

	if (await hasTemplate()) {
		await composeBuiltHtml(routes);
	}
} else {
	const { devRoutePlugin } = await import('./build/plugins/dev-route.js');
	const server = await createServer({
		root: buildOptions.source_path,
		configFile: false,
		appType: 'custom',
		plugins: [devRoutePlugin()],
		server: {
			port: buildOptions.config.server?.port,
		},
	});

	await server.listen();
	server.printUrls();
}

// /**
//  * Composes built route fragments with the built template.
//  * @param routes -
//  */
// async function composeBuiltHtml(routes: RouteData[]): Promise<void> {
// 	const output_template_path = outputPath(templatePath());
// 	const template_html = await fs.readFile(output_template_path, 'utf8');
// 	const template_parts = await splitTemplate(template_html);

// 	await Promise.all(
// 		routes.map(async (route_data) => {
// 			const source = await fs.readFile(route_data.file.path, 'utf8');
// 			if (await startsWithHtmlElement(source)) {
// 				return;
// 			}

// 			const output_page_path = outputPath(route_data.file.path);
// 			const page_html = await fs.readFile(output_page_path, 'utf8');
// 			await fs.writeFile(
// 				output_page_path,
// 				applyTemplate(template_parts, page_html),
// 				'utf8',
// 			);
// 		}),
// 	);

// 	await fs.rm(output_template_path, { force: true });
// }

// /**
//  * Returns output path for a source file.
//  * @param path -
//  * @returns -
//  */
// function outputPath(path: string): string {
// 	return nodePath.join(
// 		buildOptions.output_path,
// 		nodePath.relative(buildOptions.source_path, path),
// 	);
// }
