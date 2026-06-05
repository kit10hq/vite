import { a as configPlugin, c as output_static_path, l as source_path, n as routes, o as config, s as output_path, t as templatePlugin } from "./template-CresvizA.mjs";
import fs from "node:fs/promises";
import nodePath from "node:path";
import { build } from "vite";
import { promisify } from "node:util";
import zlib from "node:zlib";
//#region src/build/plugins/gzip.ts
const gzip = promisify(zlib.gzip);
const filter = /\.(?:html|xml|css|json|js|mjs|svg)$/iu;
/** Creates a Vite plugin that compresses output files. */
function gzipPlugin() {
	return {
		name: "kit10:gzip-static",
		apply: "build",
		enforce: "post",
		async writeBundle() {
			const promises = [];
			for await (const path of walk(output_static_path)) {
				if (!filter.test(path) || path.endsWith(".gz")) continue;
				const buffer = await fs.readFile(path);
				if (buffer.length > 1e3) {
					const compressed = await gzip(buffer, { level: 9 });
					if (compressed.length < buffer.length) promises.push(fs.writeFile(`${path}.gz`, compressed));
				}
			}
			await Promise.all(promises);
		}
	};
}
/**
* Walks through a directory and yields the paths of all files.
* @param dir The directory to walk through.
*/
async function* walk(dir) {
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		const path = nodePath.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else if (entry.isFile()) yield path;
	}
}
//#endregion
//#region src/build/server.ts
/** Configures the production server. */
async function makeServer() {
	const app_routes_js = [];
	for (const route_data of routes) app_routes_js.push(`app.get('${route_data.route}', serveFile('${route_data.file.path.replace(source_path, "")}'));`);
	const PATH_MAIN = nodePath.join(output_path, "main.js");
	let contents = await fs.readFile(PATH_MAIN, "utf8");
	contents = contents.replace("// MARK: app", app_routes_js.join("\n")).replace("port: 0,", `port: ${config.server?.port ?? 3e3},`);
	await fs.writeFile(PATH_MAIN, contents, "utf8");
}
//#endregion
//#region src/build/target/build.ts
await fs.rm(output_path, {
	recursive: true,
	force: true
});
await fs.cp(nodePath.join(import.meta.dirname, "..", "template", "hono"), output_path, { recursive: true });
const input = {};
for (const route_data of routes) {
	const name = nodePath.relative(source_path, route_data.file.path).replace(/\+page\.[a-z\d]+/u, "").replaceAll("/", "_").replaceAll("[", "(").replaceAll("]", ")");
	input[name] = route_data.file.path;
}
await build({
	root: source_path,
	configFile: false,
	appType: "custom",
	plugins: [
		configPlugin(),
		templatePlugin(),
		gzipPlugin()
	],
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
await makeServer();
//#endregion
export {};
