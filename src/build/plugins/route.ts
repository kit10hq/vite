import fs from 'node:fs/promises';
import type { OutgoingHttpHeaders } from 'node:http2';
import nodePath from 'node:path';
import { Hono } from 'hono/tiny';
import type { Plugin } from 'vite';
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
						// filePathToRootUrl(route.file.path),
						'/'
							+ nodePath.relative(
								buildOptions.source_path,
								route_data.file.path,
							),
						source.toString('utf8'),
						url_pathname,
					);

					return new Response(html, {
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
