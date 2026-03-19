import { defineNuxtModule } from "@nuxt/kit";
import { optimize, type PageflarePluginOptions } from "./core.js";

export default defineNuxtModule<PageflarePluginOptions>({
	meta: {
		name: "pageflare",
		configKey: "pageflare",
	},
	defaults: {},
	setup(options, nuxt) {
		// biome-ignore lint/suspicious/noExplicitAny: Nitro types reference @nuxt/schema which isn't portable for DTS
		nuxt.hook("nitro:init", (nitro: any) => {
			nitro.hooks.hook("close", async () => {
				const outputDir = nitro.options.output.publicDir;
				await optimize({
					inputDir: outputDir,
					inPlace: true,
					platform: options?.platform,
					log: options?.log,
					args: options?.args,
				});
			});
		});
	},
});

export type { PageflarePluginOptions };
