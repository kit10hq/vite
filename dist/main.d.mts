import { Plugin, UserConfig } from "vite";

//#region src/build/options.d.ts
type Promisable<T> = T | Promise<T>;
type CssPreprocessors = Exclude<UserConfig["css"], undefined>["preprocessorOptions"];
type Kit10Plugin = {
  kit10: true;
  htmlPreprocessor?: (path: string) => Promisable<string>;
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