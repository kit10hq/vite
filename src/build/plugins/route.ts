import fs from 'node:fs/promises';
import type { OutgoingHttpHeaders } from 'node:http2';
import nodePath from 'node:path';
import { Hono } from 'hono/tiny';
import { HTMLRewriter } from 'html-rewriter-wasm';
import type { Plugin } from 'vite';
import { isAbsoluteOrSpecialPath } from '../../utils.js';
import * as buildOptions from '../options.js';
import { getRoutes } from '../router/file-tree.js';

/** Creates a Vite plugin that serves the application's routes using Hono. */
export function routePlugin(): Plugin {
	return {
		name: 'kit10:routes',
		configureServer(server) {
			const routes = getRoutes();
			const app = new Hono();

			for (const route_data of routes) {
				app.get(route_data.route, async (context) => {
					const url_pathname = new URL(context.req.url).pathname;
					const source = await fs.readFile(route_data.file.path);
					const html = await server.transformIndexHtml(
						'/'
							+ nodePath.relative(
								buildOptions.source_path,
								route_data.file.path,
							),
						source.toString('utf8'),
						url_pathname,
					);

					return new Response(rewriteHtml(route_data.file.path, html), {
						headers: {
							'Content-Type': 'text/html; charset=utf-8',
						},
					});
				});
			}

			return () => {
				server.middlewares.use(async (request, response, next) => {
					try {
						if (request.method !== 'GET' && request.method !== 'HEAD') {
							next();
							return;
						}

						const url = new URL(
							request.url ?? '/',
							`http://${request.headers.host ?? 'kit10.local'}`,
						);

						const hono_response = await app.fetch(
							new Request(url, {
								headers: convertHeaders(request.headers),
								method: request.method,
							}),
						);

						if (hono_response.status === 404) {
							next();
							return;
						}

						response.statusCode = hono_response.status;

						for (const [name, value] of hono_response.headers) {
							response.setHeader(name, value);
						}

						if (request.method === 'HEAD') {
							response.end();
						} else {
							response.end(new Uint8Array(await hono_response.arrayBuffer()));
						}
					} catch (error) {
						server.ssrFixStacktrace(error as Error);
						next(error);
					}
				});
			};
		},
	};
}

/**
 * Converts Node request headers to WebAPI's Headers.
 * @param headers_node -
 * @returns -
 */
function convertHeaders(headers_node: OutgoingHttpHeaders): Headers {
	const headers = new Headers();

	for (const [name, value] of Object.entries(headers_node)) {
		if (value === undefined) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(name, item);
			}
		} else if (typeof value === 'string') {
			headers.set(name, value);
		} else {
			headers.set(name, String(value));
		}
	}

	return headers;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Rewrites html.
 * @param path - The relative file path of the html file.
 * @param contents - The html to rewrite.
 * @returns -
 */
function rewriteHtml(path: string, contents: string): string {
	const dir = nodePath.dirname(path);

	let result = '';
	const rewriter = new HTMLRewriter((chunk) => {
		result += textDecoder.decode(chunk);
	});

	// let tag_content = '';
	// rewriter.on('*', {
	// 	element() {
	// 		tag_content = '';
	// 	},
	// 	text(node) {
	// 		if (node.text) {
	// 			tag_content += node.text;
	// 		}
	// 	},
	// });

	rewriter.on('img,script', {
		element(node) {
			const import_path = node.getAttribute('src');
			if (import_path) {
				node.setAttribute('src', absolutePath(dir, import_path));
			}
		},
	});

	rewriter.on('link', {
		element(node) {
			const import_path = node.getAttribute('href');
			if (import_path) {
				node.setAttribute('href', absolutePath(dir, import_path));
			}
		},
	});

	rewriter.write(textEncoder.encode(contents));
	rewriter.end();

	return result;
}

/**
 * Converts a relative path to absolute.
 * @param dir - The directory of the file.
 * @param path - The relative path to convert.
 * @returns -
 */
function absolutePath(dir: string, path: string): string {
	if (isAbsoluteOrSpecialPath(path)) {
		return path;
	}

	return nodePath
		.normalize(nodePath.join(dir, path))
		.replace(buildOptions.source_path, '');
}
