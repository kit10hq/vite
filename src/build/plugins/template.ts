import nodePath from 'node:path';
import { HTMLRewriter } from 'html-rewriter-wasm';
import type { IndexHtmlTransformContext, Plugin } from 'vite';
import {
	isAbsoluteOrSpecialPath,
	textDecoder,
	textEncoder,
} from '../../utils.js';
import { rewriteHtml } from '../html.js';
import * as buildOptions from '../options.js';
import { getRoutes } from '../router/file-tree.js';
import {
	readTemplate,
	splitTemplate,
	TEMPLATE_PATH_ABSOLUTE,
	type TemplateParts,
} from '../template.js';

/**
 * Returns a set of all routed paths.
 */
function getRoutedPaths(): Set<string> {
	return new Set(
		getRoutes().map((route_data) => nodePath.resolve(route_data.file.path)),
	);
}

/** Creates a Vite plugin that wraps route HTML fragments with +template.html. */
export function templatePlugin(): Plugin {
	let routed_paths = getRoutedPaths();
	let template: TemplateParts | null = null;

	return {
		name: 'kit10:template',
		enforce: 'pre',
		transformIndexHtml: {
			order: 'pre',
			async handler(html, context) {
				if (!buildOptions.is_prod) {
					routed_paths = getRoutedPaths();
				}

				if (!routed_paths.has(context.filename)) {
					return;
				}

				const rewrite = rewriteHtml(context.filename, html);
				html = rewrite.html;
				if (rewrite.is_full_page) {
					return html;
				}

				if (!template || !buildOptions.is_prod) {
					let template_html = await readTemplate();
					if (template_html === null) {
						throw new Error(
							`Requested template, but ${TEMPLATE_PATH_ABSOLUTE} not found.`,
						);
					}

					template_html = rewriteHtml(
						TEMPLATE_PATH_ABSOLUTE,
						template_html,
					).html;

					// eslint-disable-next-line require-atomic-updates
					template = splitTemplate(template_html);
				}

				return template.start + html + template.end;
			},
		},
	};
}
