import { defineNuxtModule } from "@nuxt/kit";
import {
	optimize,
	type PageflarePluginOptions,
	pluginOptionsToOptimize,
} from "./core.js";

interface ConflictEntry {
	keys: Record<string, false>;
	description: string;
}

const CONFLICT_MAP: Record<string, ConflictEntry> = {
	"@nuxtjs/critters": {
		keys: { critical_css: false },
		description: "critical CSS inlining",
	},
	"nuxt-critters": {
		keys: { critical_css: false },
		description: "critical CSS inlining",
	},
};

export default defineNuxtModule<PageflarePluginOptions>({
	meta: {
		name: "pageflare",
		configKey: "pageflare",
	},
	defaults: {},
	setup(options, nuxt) {
		const configOverrides: Record<string, unknown> = {
			...options?.configOverrides,
		};

		// Detect conflicting modules
		const moduleNames = (nuxt.options.modules || [])
			.map((m) => (typeof m === "string" ? m : Array.isArray(m) ? m[0] : ""))
			.filter(Boolean);

		for (const [name, conflict] of Object.entries(CONFLICT_MAP)) {
			if (moduleNames.includes(name)) {
				const skippedKeys = Object.keys(conflict.keys).join(", ");
				console.warn(
					`[pageflare] Detected "${name}" which already handles ${conflict.description}. ` +
						`Pageflare will skip: ${skippedKeys}. ` +
						`You can remove "${name}" to let Pageflare handle this instead.`,
				);
				Object.assign(configOverrides, conflict.keys);
			}
		}

		nuxt.hook("nitro:init", (nitro: any) => {
			nitro.hooks.hook("close", async () => {
				const outputDir = nitro.options.output.publicDir;
				await optimize({
					inputDir: outputDir,
					inPlace: true,
					...pluginOptionsToOptimize(options),
					configOverrides:
						Object.keys(configOverrides).length > 0
							? configOverrides
							: undefined,
				});
			});
		});
	},
});

export type { PageflarePluginOptions };
