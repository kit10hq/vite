import { a as getRoutes, c as source_path, i as isAbsoluteOrSpecialPath, n as readTemplate, r as splitTemplate, t as TEMPLATE_PATH_ABSOLUTE } from "./template-CxwtrCs-.mjs";
import fs from "node:fs/promises";
import nodePath from "node:path";
import { HTMLRewriter } from "html-rewriter-wasm";
import { Hono } from "hono/tiny";
//#region src/build/plugins/route.ts
/** Creates a Vite plugin that serves the application's routes using Hono. */
function routePlugin() {
	return {
		name: "kit10:routes",
		configureServer(server) {
			const routes = getRoutes();
			const app = new Hono();
			for (const route_data of routes) app.get(route_data.route, async (context) => {
				const url_pathname = new URL(context.req.url).pathname;
				let html = await fs.readFile(route_data.file.path, "utf8");
				html = await server.transformIndexHtml("/" + nodePath.relative(source_path, route_data.file.path), html, url_pathname);
				const rewrite = rewriteHtml(route_data.file.path, html);
				html = rewrite.html;
				if (rewrite.is_full_page) return htmlResponse(html);
				let template_html = await readTemplate();
				if (!template_html) return htmlResponse(html);
				template_html = await server.transformIndexHtml(TEMPLATE_PATH_ABSOLUTE, template_html, url_pathname);
				template_html = rewriteHtml(TEMPLATE_PATH_ABSOLUTE, template_html).html;
				const template = splitTemplate(template_html);
				return htmlResponse(template.start + html + template.end);
			});
			return () => {
				server.middlewares.use(async (request, response, next) => {
					try {
						if (request.method !== "GET" && request.method !== "HEAD") {
							next();
							return;
						}
						const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "kit10.local"}`);
						const hono_response = await app.fetch(new Request(url, {
							headers: convertHeaders(request.headers),
							method: request.method
						}));
						if (hono_response.status === 404) {
							next();
							return;
						}
						response.statusCode = hono_response.status;
						for (const [name, value] of hono_response.headers) response.setHeader(name, value);
						if (request.method === "HEAD") response.end();
						else response.end(new Uint8Array(await hono_response.arrayBuffer()));
					} catch (error) {
						server.ssrFixStacktrace(error);
						next(error);
					}
				});
			};
		}
	};
}
/**
* Creates HTML response.
* @param contents -
* @returns -
*/
function htmlResponse(contents) {
	return new Response(contents, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
/**
* Converts Node request headers to WebAPI's Headers.
* @param headers_node -
* @returns -
*/
function convertHeaders(headers_node) {
	const headers = new Headers();
	for (const [name, value] of Object.entries(headers_node)) {
		if (value === void 0) continue;
		if (Array.isArray(value)) for (const item of value) headers.append(name, item);
		else if (typeof value === "string") headers.set(name, value);
		else headers.set(name, String(value));
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
function rewriteHtml(path, contents) {
	const dir = nodePath.dirname(path);
	let result = "";
	let is_full_page;
	const rewriter = new HTMLRewriter((chunk) => {
		result += textDecoder.decode(chunk);
	});
	rewriter.on("*", { element(node) {
		is_full_page ??= node.tagName === "html";
	} });
	rewriter.on("img", { element(node) {
		const import_path = node.getAttribute("src");
		if (import_path) node.setAttribute("src", absolutePath(dir, import_path));
	} });
	rewriter.on("script", { element(node) {
		const import_path = node.getAttribute("src");
		if (import_path) node.setAttribute("src", absolutePath(dir, import_path));
	} });
	rewriter.on("link", { element(node) {
		const import_path = node.getAttribute("href");
		if (import_path) node.setAttribute("href", absolutePath(dir, import_path));
	} });
	rewriter.write(textEncoder.encode(contents));
	rewriter.end();
	return {
		is_full_page: is_full_page ?? false,
		html: result
	};
}
/**
* Converts a relative path to absolute.
* @param dir - The directory of the file.
* @param path - The relative path to convert.
* @returns -
*/
function absolutePath(dir, path) {
	console.log("absolutePath", dir, path);
	if (isAbsoluteOrSpecialPath(path)) return path;
	return nodePath.normalize(nodePath.join(dir, path)).replace(source_path, "");
}
//#endregion
export { routePlugin };
