import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { HTMLRewriter } from 'html-rewriter-wasm';
import { textDecoder, textEncoder } from '../utils.js';
import * as buildOptions from './options.js';

export type TemplateParts = {
	start: string;
	end: string;
};

export const TEMPLATE_PATH = '+template.html';
export const TEMPLATE_PATH_ABSOLUTE: string = nodePath.join(
	buildOptions.source_path,
	TEMPLATE_PATH,
);

/**
 * Reads the +template.html file from the source path, if it exists.
 * @returns - The contents of the template file, or `undefined` if it does not exist.
 */
export async function readTemplate(): Promise<string | null> {
	try {
		await fs.access(TEMPLATE_PATH_ABSOLUTE);
		return fs.readFile(TEMPLATE_PATH_ABSOLUTE, 'utf8');
	} catch {
		return null;
	}
}

/**
 * Splits +template.html file into parts to place page contents in between.
 * @returns -
 */
export function splitTemplate(html: string): TemplateParts {
	const placeholder = `<!--kit10:${randomUUID()}-->`;
	let result = '';
	const rewriter = new HTMLRewriter((chunk) => {
		result += textDecoder.decode(chunk);
	});

	rewriter.on('kit10\\:page', {
		element(element) {
			element.replace(placeholder, { html: true });
		},
	});

	rewriter.write(textEncoder.encode(html));
	rewriter.end();

	const parts = result.split(placeholder);
	if (parts.length !== 2) {
		throw new Error(
			`${TEMPLATE_PATH} must contain exactly one <kit10:page></kit10:page>.`,
		);
	}

	return {
		start: parts[0]!,
		end: parts[1]!,
	};
}
