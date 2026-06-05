import { a as config, c as source_path, i as textEncoder, n as rewriteHtml, o as is_prod, r as textDecoder, s as output_static_path, t as getRoutes } from "./file-tree-BqJ97cVo.mjs";
import nodePath from "node:path";
import { build, createServer } from "vite";
import { HTMLRewriter } from "html-rewriter-wasm";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
//#region src/build/template.ts
const TEMPLATE_PATH = "+template.html";
const TEMPLATE_PATH_ABSOLUTE = nodePath.join(source_path, TEMPLATE_PATH);
/**
* Reads the +template.html file from the source path, if it exists.
* @returns - The contents of the template file, or `undefined` if it does not exist.
*/
async function readTemplate() {
	try {
		await fs.access(TEMPLATE_PATH_ABSOLUTE);
		return fs.readFile(TEMPLATE_PATH_ABSOLUTE, "utf8");
	} catch {
		return null;
	}
}
/**
* Splits +template.html file into parts to place page contents in between.
* @returns -
*/
function splitTemplate(html) {
	const placeholder = `<!--kit10:${randomUUID()}-->`;
	let result = "";
	const rewriter = new HTMLRewriter((chunk) => {
		result += textDecoder.decode(chunk);
	});
	rewriter.on("kit10\\:page", { element(element) {
		element.replace(placeholder, { html: true });
	} });
	rewriter.write(textEncoder.encode(html));
	rewriter.end();
	const parts = result.split(placeholder);
	if (parts.length !== 2) throw new Error(`${TEMPLATE_PATH} must contain exactly one <kit10:page></kit10:page>.`);
	return {
		start: parts[0],
		end: parts[1]
	};
}
//#endregion
//#region src/build/plugins/template.ts
/**
* Returns a set of all routed paths.
*/
function getRoutedPaths() {
	return new Set(getRoutes().map((route_data) => nodePath.resolve(route_data.file.path)));
}
/** Creates a Vite plugin that wraps route HTML fragments with +template.html. */
function templatePlugin() {
	let routed_paths = getRoutedPaths();
	let template = null;
	return {
		name: "kit10:template",
		enforce: "pre",
		transformIndexHtml: {
			order: "pre",
			async handler(html, context) {
				if (!is_prod) routed_paths = getRoutedPaths();
				if (!routed_paths.has(context.filename)) return;
				const rewrite = rewriteHtml(context.filename, html);
				html = rewrite.html;
				if (rewrite.is_full_page) return html;
				if (!template || !is_prod) {
					let template_html = await readTemplate();
					if (template_html === null) throw new Error(`Requested template, but ${TEMPLATE_PATH_ABSOLUTE} not found.`);
					template_html = rewriteHtml(TEMPLATE_PATH_ABSOLUTE, template_html).html;
					template = splitTemplate(template_html);
				}
				return template.start + html + template.end;
			}
		}
	};
}
//#endregion
//#region src/build.ts
if (is_prod) {
	const routes = getRoutes();
	const input = {};
	for (const route_data of routes) {
		const name = nodePath.relative(source_path, route_data.file.path).replace(/\+page\.[a-z\d]+/u, "").replaceAll("/", "_").replaceAll("[", "(").replaceAll("]", ")");
		input[name] = route_data.file.path;
	}
	await build({
		root: source_path,
		configFile: false,
		appType: "custom",
		plugins: [templatePlugin()],
		build: {
			outDir: output_static_path,
			emptyOutDir: true,
			manifest: true,
			rolldownOptions: {
				input,
				output: {
					assetFileNames: "assets/[name]-[hash][extname]",
					chunkFileNames: "assets/chunks/[name]-[hash].js",
					entryFileNames: "assets/[name]-[hash].js"
				}
			}
		}
	});
} else {
	const { devRoutePlugin } = await import("./dev-route-1Pee1kzp.mjs");
	const server = await createServer({
		root: source_path,
		configFile: false,
		appType: "custom",
		plugins: [templatePlugin(), devRoutePlugin()],
		server: { port: config.server?.port }
	});
	await server.listen();
	server.printUrls();
}
//#endregion
export {};
