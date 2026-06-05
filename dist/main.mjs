#!/usr/bin/env node
//#region src/main.ts
const command = process.argv[2];
if (command === "dev") await import("./dev-BAnS-PC4.mjs");
else if (command === "build") await import("./build-BGDJLawl.mjs");
else {
	console.error(`Unknown command "${command ?? ""}".`);
	process.exit(1);
}
//#endregion
export {};
