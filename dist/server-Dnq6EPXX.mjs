import { i as output_path, n as config, o as source_path } from "./file-tree-Dl6oXx4j.mjs";
import { t as routes } from "./router-W326qal1.mjs";
import fs from "node:fs/promises";
import nodePath from "node:path";
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
export { makeServer };
