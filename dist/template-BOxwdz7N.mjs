import fs from "node:fs/promises";
import nodePath from "node:path";
import { HTMLRewriter } from "html-rewriter-wasm";
import { readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
//#region src/build/options.ts
const is_prod = process.argv[2] === "build";
const config = (await import(nodePath.join(process.cwd(), "kit10.config.js"))).default;
const vitePlugins = config.plugins ? config.plugins.map((plugin) => {
	if ("kit10" in plugin) return plugin.vitePlugins;
	return plugin;
}) : [];
const source_path = nodePath.join(process.cwd(), "src");
const output_path = nodePath.join(process.cwd(), "dist");
const output_static_path = nodePath.join(output_path, "static");
//#endregion
//#region src/build/plugins/config.ts
/** Configures the Vite plugin that updates Vite config. */
function configPlugin() {
	return {
		name: "kit10:config",
		config() {
			return { css: { preprocessorOptions: config.build?.css_preprocessors } };
		}
	};
}
//#endregion
//#region src/utils.ts
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
/**
* Returns whether a path already has non-relative behavior.
* @param path -
* @returns -
*/
function isAbsoluteOrSpecialPath(path) {
	return path.startsWith("/") || path.startsWith("#") || path.startsWith("//") || /^[a-z][a-z\d+.-]*:/iu.test(path);
}
//#endregion
//#region src/build/html.ts
/**
* Rewrites html.
* @param path - The absolute file path of the html file.
* @param contents - The html to rewrite.
* @returns -
*/
function rewriteHtml(path, contents) {
	const dir = nodePath.dirname(path);
	let result = "";
	let first_tag_name;
	let is_kit10_head = false;
	let kit10_head = "";
	const rewriter = new HTMLRewriter((chunk) => {
		const chunk_string = textDecoder.decode(chunk);
		if (is_kit10_head) kit10_head += chunk_string;
		else result += chunk_string;
	});
	rewriter.on("*", { element(element) {
		first_tag_name ??= element.tagName.toLowerCase();
	} });
	rewriter.on("kit10\\:head", { element(element) {
		is_kit10_head = true;
		element.removeAndKeepContent();
		element.onEndTag(() => {
			is_kit10_head = false;
		});
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
		is_full_page: first_tag_name === "html",
		kit10_head,
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
	if (isAbsoluteOrSpecialPath(path)) return path;
	return nodePath.normalize(nodePath.join(dir, path)).replace(source_path, "");
}
//#endregion
//#region src/build/router/filename.ts
const RE_ENTRYPOINT = /^(?<name>.+)\+page\.(?<ext>[a-z]+)$/iu;
const RE_OPTIONAL_CATCH_ALL = /^\[\[\.\.\.(?<key>[a-z_][\da-z_]*)\]\]$/iu;
const RE_CATCH_ALL = /^\[\.\.\.(?<key>[a-z_][\da-z_]*)\]$/iu;
/**
* Checks if file is an entrypoint file (i.e. ends with `+page.html`).
* Returns the filename without the `.page.html` extension, or `null` if not found.
*/
function getEntrypointName(name) {
	const match = RE_ENTRYPOINT.exec(name);
	if (!match) return null;
	return {
		name: match.groups.name,
		ext: match.groups.ext
	};
}
/**
* Returns specificity for route.
*
* Values:
* - 0: static route (e.g. `/foo`)
* - 1: route with parameter (e.g. `/foo-:id`)
* - 2: route with optional parameter (e.g. `/foo-:id?`)
* - 3: route with greedy parameter (e.g. `/foo-:id+`)
* - 4: (NOT USED) route with wildcard (e.g. `/*`)
* @param name -
* @returns -
*/
function parseFilename(name) {
	if (name.length === 0) throw new Error("File name can not be just +page.<ext>.");
	const match_optional_catch_all = RE_OPTIONAL_CATCH_ALL.exec(name);
	if (match_optional_catch_all) return [{
		route_part: "",
		specificity: {
			type: 0,
			static_length: 0
		}
	}, {
		route_part: `:${match_optional_catch_all.groups.key}{.+}`,
		specificity: {
			type: 3,
			static_length: 0
		}
	}];
	const match_catch_all = RE_CATCH_ALL.exec(name);
	if (match_catch_all) return [{
		route_part: `:${match_catch_all.groups.key}{.+}`,
		specificity: {
			type: 3,
			static_length: 0
		}
	}];
	let has_optional = false;
	let static_length = name.length;
	const route_part = name.replaceAll(/(\[([a-z_][\da-z_]*)\]|\[\[([a-z_][\da-z_]*)\]\])([^\da-z_]|$)/giu, (...args) => {
		static_length -= args[1].length;
		if (args[3] !== void 0) {
			has_optional = true;
			return `:${args[3]}?${args[4]}`;
		}
		return `:${args[2]}${args[4]}`;
	});
	if (name !== route_part) return [{
		route_part,
		specificity: {
			type: has_optional ? 2 : 1,
			static_length
		}
	}];
	if (name.includes("[") !== true) return [{
		route_part,
		specificity: {
			type: 0,
			static_length: 0
		}
	}];
	throw new Error(`Invalid filename "${name}".`);
}
//#endregion
//#region src/build/router/file-tree.ts
/**
* Returns the routes for the given path.
* @returns -
*/
function getRoutes() {
	return flatState(walk(source_path));
}
/**
* Walks the file tree at the given path and populates the walk state with the routes.
* @param path The path to walk.
* @param state The walk state to populate.
*/
function walk(path, state) {
	state ??= {
		file: void 0,
		route: "/",
		specificity: {
			type: 0,
			static_length: 0
		},
		children: []
	};
	const entries = readdirSync(path, { withFileTypes: true });
	if (process.env.NODE_ENV === "test") for (let i = entries.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[entries[i], entries[j]] = [entries[j], entries[i]];
	}
	for (const entry of entries) {
		const entry_path = nodePath.join(entry.parentPath, entry.name);
		if (entry.isFile()) {
			const entrypoint = getEntrypointName(entry.name);
			if (entrypoint === null) continue;
			if (entrypoint.name.length === 0) throw new Error(`File name can not be just +page.<ext>, got ${entry_path}.`);
			const route_defs = parseFilename(entrypoint.name);
			for (const route_def of route_defs) if (route_def.route_part.length === 0 || route_def.route_part === "index") state.file = {
				path: entry_path,
				ext: entrypoint.ext
			};
			else state.children.push({
				route: (state.route === "/" ? "" : state.route) + nodePath.sep + route_def.route_part,
				file: {
					path: entry_path,
					ext: entrypoint.ext
				},
				specificity: route_def.specificity
			});
		} else if (entry.isDirectory()) {
			const route_defs = parseFilename(entry.name);
			if (route_defs.length > 1) throw new Error(`Invalid directory name "${entry.name}" at "${entry_path}".`);
			const route_def = route_defs[0];
			const walk_state_child = {
				file: void 0,
				route: (state.route === "/" ? "" : state.route) + nodePath.sep + route_def.route_part,
				specificity: route_def.specificity,
				children: []
			};
			state.children.push(walk_state_child);
			walk(entry_path, walk_state_child);
		}
	}
	sortRoutes(state);
	return state;
}
/**
* Flattens the state into a list of routes.
* @param state The state to flatten.
*/
function flatState(state, routes_data = []) {
	if (state.file !== void 0) routes_data.push({
		route: state.route,
		file: state.file
	});
	if ("children" in state) for (const child of state.children) flatState(child, routes_data);
	return routes_data;
}
/**
* Sorts the routes in the given result.
* @param result The result to sort.
*/
function sortRoutes(result) {
	result.children.sort((a, b) => {
		if (a.specificity.type !== b.specificity.type) return a.specificity.type - b.specificity.type;
		if (a.specificity.static_length !== b.specificity.static_length) return b.specificity.static_length - a.specificity.static_length;
		return 0;
	});
}
//#endregion
//#region src/build/router.ts
const routes = getRoutes();
//#endregion
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
	const placeholder_head = `<!--${randomUUID()}-->`;
	const placeholder_page = `<!--${randomUUID()}-->`;
	let result = "";
	const rewriter = new HTMLRewriter((chunk) => {
		result += textDecoder.decode(chunk);
	});
	rewriter.on("head", { element(element) {
		element.append(placeholder_head, { html: true });
	} });
	rewriter.on("kit10\\:page", { element(element) {
		element.replace(placeholder_page, { html: true });
	} });
	rewriter.write(textEncoder.encode(html));
	rewriter.end();
	const parts_by_head = result.split(placeholder_head);
	if (parts_by_head.length !== 2) throw new Error(`Internal error: can not split ${TEMPLATE_PATH} by head comment.`);
	const before_head = parts_by_head[0];
	const parts_by_page = parts_by_head[1].split(placeholder_page);
	if (parts_by_page.length !== 2) throw new Error(`${TEMPLATE_PATH} must contain exactly one <kit10:page> tag.`);
	return {
		before_head,
		before_page: parts_by_page[0],
		after_page: parts_by_page[1]
	};
}
/**
* Wraps the HTML content in the template parts.
* @param templateParts - The template parts to wrap the HTML content in.
* @param htmlContent - The HTML content to wrap.
* @returns The wrapped HTML content.
*/
function wrapInTemplate(templateParts, htmlContent) {
	return templateParts.before_head + htmlContent.kit10_head + templateParts.before_page + htmlContent.html + templateParts.after_page;
}
//#endregion
//#region src/build/plugins/template.ts
/**
* Returns a set of all routed paths.
*/
function getRoutedPaths(routes_) {
	return new Set(routes_.map((route_data) => nodePath.resolve(route_data.file.path)));
}
/** Creates a Vite plugin that wraps route HTML fragments with +template.html. */
function templatePlugin() {
	let routed_paths = getRoutedPaths(routes);
	let templateParts = null;
	return {
		name: "kit10:template",
		enforce: "pre",
		transformIndexHtml: {
			order: "pre",
			async handler(html, context) {
				if (!is_prod) routed_paths = getRoutedPaths(getRoutes());
				if (!routed_paths.has(context.filename)) return;
				const htmlContent = rewriteHtml(context.filename, html);
				html = htmlContent.html;
				if (htmlContent.is_full_page) return html;
				if (!templateParts || !is_prod) {
					let template_html = await readTemplate();
					if (template_html === null) throw new Error(`Requested template, but ${TEMPLATE_PATH_ABSOLUTE} not found.`);
					template_html = rewriteHtml(TEMPLATE_PATH_ABSOLUTE, template_html).html;
					templateParts = splitTemplate(template_html);
				}
				return wrapInTemplate(templateParts, htmlContent);
			}
		}
	};
}
//#endregion
export { configPlugin as a, output_static_path as c, rewriteHtml as i, source_path as l, routes as n, config as o, getRoutes as r, output_path as s, templatePlugin as t, vitePlugins as u };
