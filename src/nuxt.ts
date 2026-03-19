import { defineNuxtModule, type useNitro, type useNuxt } from "@nuxt/kit";
import { optimize, type PageflarePluginOptions } from "./core.js";

type Nuxt = ReturnType<typeof useNuxt>;
type Nitro = ReturnType<typeof useNitro>;

export default defineNuxtModule<PageflarePluginOptions>({
	meta: {
		name: "pageflare",
		configKey: "pageflare",
	},
	defaults: {},
	setup(options: PageflarePluginOptions, nuxt: Nuxt) {
		nuxt.hook("nitro:init", (nitro: Nitro) => {
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
