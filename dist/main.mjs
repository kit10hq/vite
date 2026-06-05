#!/usr/bin/env node
//#region src/main.ts
const command = process.argv[2];
if (command === "dev" || command === "build") await import("./build-COkkE-5n.mjs");
else {
	process.stderr.write(`Unknown command "${command ?? ""}". Use "dev" or "build".\n`);
	process.exit(1);
}
//#endregion
export {};
