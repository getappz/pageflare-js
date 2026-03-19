import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { optimize, type PageflarePluginOptions } from "./core.js";

export default function pageflare(
	options?: PageflarePluginOptions,
): AstroIntegration {
	return {
		name: "pageflare",
		hooks: {
			"astro:build:done": async ({ dir }) => {
				await optimize({
					inputDir: fileURLToPath(dir),
					inPlace: true,
					platform: options?.platform,
					log: options?.log,
					args: options?.args,
				});
			},
		},
	};
}

export type { PageflarePluginOptions };
