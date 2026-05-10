import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
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
	"astro-compress": {
		keys: { minify_html: false, minify_css: false, minify_js: false },
		description: "HTML/CSS/JS minification",
	},
	"@playform/compress": {
		keys: { minify_html: false, minify_css: false, minify_js: false },
		description: "HTML/CSS/JS minification",
	},
	"astro-html-minifier": {
		keys: { minify_html: false },
		description: "HTML minification",
	},
	"astro-critters": {
		keys: { critical_css: false },
		description: "critical CSS extraction",
	},
};

export default function pageflare(
	options?: PageflarePluginOptions,
): AstroIntegration {
	const configOverrides: Record<string, unknown> = {
		...options?.configOverrides,
	};

	return {
		name: "pageflare",
		hooks: {
			"astro:config:done": ({ config, logger }) => {
				const integrationNames = config.integrations.map((i) => i.name);

				for (const [name, conflict] of Object.entries(CONFLICT_MAP)) {
					if (integrationNames.includes(name)) {
						const skippedKeys = Object.keys(conflict.keys).join(", ");
						logger.warn(
							`Detected "${name}" which already handles ${conflict.description}. ` +
								`Pageflare will skip: ${skippedKeys}. ` +
								`You can remove "${name}" to let Pageflare handle this instead.`,
						);
						Object.assign(configOverrides, conflict.keys);
					}
				}
			},
			"astro:build:done": async ({ dir }) => {
				await optimize({
					inputDir: fileURLToPath(dir),
					inPlace: true,
					...pluginOptionsToOptimize(options),
					configOverrides:
						Object.keys(configOverrides).length > 0
							? configOverrides
							: undefined,
				});
			},
		},
	};
}

export type { PageflarePluginOptions };
