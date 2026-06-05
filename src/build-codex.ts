// oxlint-disable typescript/ban-ts-comment
// @ts-nocheck

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import nodePath from 'node:path';
import { build, createServer, type Plugin, type ViteDevServer } from 'vite';
import * as buildOptions from './build/options.js';
import { getRoutes } from './build/router/file-tree.js';

type Route = ReturnType<typeof getRoutes>[number];

/**
 * Creates Vite HTML inputs from routes.
 * @param file_routes File routes.
 * @returns Vite input map.
 */
function createHtmlInputs(file_routes: Route[]): Record<string, string> {
	const input: Record<string, string> = {};
	const used_names = new Set<string>();

	for (const route of file_routes) {
		if (route.file.ext !== 'html') {
			throw new Error(
				`Only .html route files are supported for now, got "${route.file.path}".`,
			);
		}

		input[uniqueInputName(route.route, used_names)] = route.file.path;
	}

	return input;
}

/**
 * Returns a unique Vite input name for a route.
 * @param route Route path.
 * @param used_names Already used names.
 * @returns Unique input name.
 */
function uniqueInputName(route: string, used_names: Set<string>): string {
	const base = route === '/' ? 'index' : routeToName(route);
	let name = base;
	let index = 2;

	while (used_names.has(name)) {
		name = `${base}-${index++}`;
	}

	used_names.add(name);
	return name;
}

/**
 * Converts a route path to a readable file name.
 * @param route Route path.
 * @returns Input name.
 */
function routeToName(route: string): string {
	return route
		.replace(/^\//u, '')
		.replaceAll(/:[a-z_][\da-z_]*/giu, (name) => name.slice(1))
		.replaceAll(/[^\da-z]+/giu, '-')
		.replaceAll(/^-|-$/gu, '')
		.toLowerCase();
}

/**
 * Returns the Vite root URL for a source file.
 * @param file_path Source file path.
 * @returns Root URL.
 */
function filePathToRootUrl(file_path: string): string {
	return `/${nodePath
		.relative(buildOptions.source_path, file_path)
		.split(nodePath.sep)
		.join('/')}`;
}

/**
 * Rewrites HTML asset URLs so routed pages can be served from pretty URLs.
 * @param html HTML source.
 * @param owner_file_path File that owns the HTML source.
 * @returns HTML with root-relative asset URLs.
 */
function absolutizeHtmlAssetUrls(
	html: string,
	owner_file_path: string,
): string {
	return html.replaceAll(/<(?:script|link|img)\b[^>]*>/giu, (tag) =>
		tag.replaceAll(/\s(?:src|href)=(?:"[^"]*"|'[^']*')/giu, (attr) =>
			absolutizeHtmlUrlAttribute(attr, owner_file_path),
		),
	);
}

/**
 * Rewrites a single src/href attribute when it points to a relative asset.
 * @param attr Attribute source.
 * @param owner_file_path File that owns the HTML source.
 * @returns Rewritten attribute source.
 */
function absolutizeHtmlUrlAttribute(
	attr: string,
	owner_file_path: string,
): string {
	const match =
		/^\s(?<name>src|href)=(?<quote>["'])(?<url>.*)\k<quote>$/isu.exec(attr);
	if (match === null) {
		return attr;
	}

	const url = match.groups!.url!;
	if (isAbsoluteOrSpecialUrl(url)) {
		return attr;
	}

	const url_match = /^(?<path>[^?#]*)(?<suffix>[?#].*)?$/su.exec(url);
	if (url_match === null || url_match.groups!.path!.length === 0) {
		return attr;
	}

	const target_path = nodePath.resolve(
		nodePath.dirname(owner_file_path),
		url_match.groups!.path!,
	);

	return ` ${match.groups!.name!}=${match.groups!.quote!}${filePathToRootUrl(
		target_path,
	)}${url_match.groups!.suffix ?? ''}${match.groups!.quote!}`;
}
