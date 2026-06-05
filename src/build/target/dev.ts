import { createServer } from 'vite';
import * as buildOptions from '../options.js';
import { devRoutePlugin } from '../plugins/dev-route.js';
import { templatePlugin } from '../plugins/template.js';

const server = await createServer({
	root: buildOptions.source_path,
	configFile: false,
	appType: 'custom',
	plugins: [templatePlugin(), devRoutePlugin()],
	server: {
		port: buildOptions.config.server?.port,
	},
});

await server.listen();
server.printUrls();
