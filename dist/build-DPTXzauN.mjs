import { a as source_path, i as output_path, n as config, r as is_prod, t as getRoutes } from "./file-tree-nmDbMldM.mjs";
import nodePath from "node:path";
import { build, createServer } from "vite";
//#region src/build.ts
if (is_prod) {
	const input = {};
	for (const route_data of getRoutes()) {
		const name = nodePath.relative(source_path, route_data.file.path).replace(/\+page\.[a-z\d]+/u, "").replaceAll("[", "(").replaceAll("]", ")").replaceAll("/", "_");
		input[name] = route_data.file.path;
	}
	console.log(input);
	await build({
		root: source_path,
		configFile: false,
		appType: "custom",
		build: {
			outDir: output_path,
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
	const { routePlugin } = await import("./route-C-aypdWf.mjs");
	const server = await createServer({
		root: source_path,
		configFile: false,
		appType: "custom",
		plugins: [routePlugin()],
		server: { port: config.server?.port }
	});
	await server.listen();
	server.printUrls();
}
//#endregion
export {};
