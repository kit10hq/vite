import { i as source_path, n as config, r as is_prod } from "./file-tree-DVp0VADH.mjs";
import "node:fs/promises";
import "node:path";
import { createServer } from "vite";
//#region src/build.ts
if (is_prod) throw new Error("Cannot build in production mode.");
else {
	const { routePlugin } = await import("./route-DdV9Bwpp.mjs");
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
