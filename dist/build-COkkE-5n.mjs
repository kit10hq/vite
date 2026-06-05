import { c as source_path, o as config, s as is_prod } from "./template-CxwtrCs-.mjs";
import "node:fs/promises";
import "node:path";
import { createServer } from "vite";
//#region src/build.ts
if (is_prod) throw new Error("Cannot build in production mode.");
else {
	const { routePlugin } = await import("./route-CUAFJtK1.mjs");
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
