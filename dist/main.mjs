#!/usr/bin/env node
//#region src/main.ts
const command = process.argv[2];
if (command === "dev") await import("./dev-ZnrZsk2-.mjs");
else if (command === "build") await import("./build-ByewvPHP.mjs");
else {
	console.error(`Unknown command "${command ?? ""}".`);
	process.exit(1);
}
//#endregion
export {};
