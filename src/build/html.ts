import nodePath from 'node:path';
import { HTMLRewriter } from 'html-rewriter-wasm';
import { isAbsoluteOrSpecialPath, textDecoder, textEncoder } from '../utils.js';
import * as buildOptions from './options.js';

export type HtmlContent = {
	is_full_page: boolean;
	kit10_head: string;
	html: string;
};

/**
 * Rewrites html.
 * @param path - The absolute file path of the html file.
 * @param contents - The html to rewrite.
 * @returns -
 */
export function rewriteHtml(path: string, contents: string): HtmlContent {
	const dir = nodePath.dirname(path);

	let result = '';
	let first_tag_name;
	let is_kit10_head = false;
	let kit10_head = '';
	const rewriter = new HTMLRewriter((chunk) => {
		const chunk_string = textDecoder.decode(chunk);
		if (is_kit10_head) {
			kit10_head += chunk_string;
		} else {
			result += chunk_string;
		}
	});

	rewriter.on('*', {
		element(element) {
			first_tag_name ??= element.tagName.toLowerCase();
		},
	});

	rewriter.on('kit10\\:head', {
		element(element) {
			is_kit10_head = true;
			element.removeAndKeepContent();
			element.onEndTag(() => {
				is_kit10_head = false;
			});
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
		kit10_head,
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
