import nodePath from 'node:path';
import { HTMLRewriter } from 'html-rewriter-wasm';
import { isAbsoluteOrSpecialPath, textDecoder, textEncoder } from '../utils.js';
import * as buildOptions from './options.js';

/**
 * Rewrites html.
 * @param path - The absolute file path of the html file.
 * @param contents - The html to rewrite.
 * @returns -
 */
export function rewriteHtml(
	path: string,
	contents: string,
): { is_full_page: boolean; html: string } {
	const dir = nodePath.dirname(path);

	let result = '';
	let first_tag_name;
	const rewriter = new HTMLRewriter((chunk) => {
		result += textDecoder.decode(chunk);
	});

	rewriter.on('*', {
		element(node) {
			first_tag_name ??= node.tagName.toLowerCase();
		},
	});

	rewriter.on('img', {
		element(node) {
			const import_path = node.getAttribute('src');
			if (import_path) {
				node.setAttribute('src', absolutePath(dir, import_path));
			}
		},
	});

	rewriter.on('script', {
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

	return {
		is_full_page: first_tag_name === 'html',
		html: result,
	};
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
