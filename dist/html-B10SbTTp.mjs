import { o as source_path } from "./file-tree-Dl6oXx4j.mjs";
import nodePath from "node:path";
import { HTMLRewriter } from "html-rewriter-wasm";
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
	const rewriter = new HTMLRewriter((chunk) => {
		result += textDecoder.decode(chunk);
	});
	rewriter.on("*", { element(node) {
		first_tag_name ??= node.tagName.toLowerCase();
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
export { textDecoder as n, textEncoder as r, rewriteHtml as t };
