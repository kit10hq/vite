import { Plugin, UserConfig } from "vite";

//#region src/build/options.d.ts
type CssPreprocessors = Exclude<UserConfig["css"], undefined>["preprocessorOptions"];
type Kit10Plugin = {
  kit10: true;
  htmlPreprocessors?: unknown[];
  vitePlugins?: Plugin[];
};
type Config = {
  /** List of plugins to use. */plugins?: (Kit10Plugin | Plugin | Plugin[])[]; /** Build options. */
  build?: {
    /** If file size is within this threshold, it will be inlined into page. */html_inline_threshold?: number;
    css_preprocessors?: CssPreprocessors;
  }; /** Server options. */
  server?: {
    /** Port to listen on. */port?: number;
  };
};
//#endregion
export type { Config, Kit10Plugin };