import { resolve } from "node:path";
import type { Plugin } from "vite";
import { optimize, type PageflarePluginOptions } from "./core.js";

export default function pageflare(options?: PageflarePluginOptions): Plugin {
	let outputDir: string;

	return {
		name: "pageflare",
		apply: "build",
		configResolved(config) {
			outputDir = resolve(config.root, config.build.outDir);
		},
		async closeBundle() {
			await optimize({
				inputDir: outputDir,
				inPlace: true,
				platform: options?.platform,
				log: options?.log,
				args: options?.args,
			});
		},
	};
}

export type { PageflarePluginOptions };
