import { resolve } from "node:path";
import type { Plugin } from "vite";
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
	"vite-plugin-minify": {
		keys: { minify_html: false },
		description: "HTML minification",
	},
	"vite-plugin-html": {
		keys: { minify_html: false },
		description: "HTML minification",
	},
};

export default function pageflare(options?: PageflarePluginOptions): Plugin {
	let outputDir: string;
	const configOverrides: Record<string, unknown> = {
		...options?.configOverrides,
	};

	return {
		name: "pageflare",
		apply: "build",
		configResolved(config) {
			outputDir = resolve(config.root, config.build.outDir);

			const pluginNames = config.plugins.map((p) => p.name);
			for (const [name, conflict] of Object.entries(CONFLICT_MAP)) {
				if (pluginNames.includes(name)) {
					const skippedKeys = Object.keys(conflict.keys).join(", ");
					console.warn(
						`[pageflare] Detected "${name}" which already handles ${conflict.description}. ` +
							`Pageflare will skip: ${skippedKeys}. ` +
							`You can remove "${name}" to let Pageflare handle this instead.`,
					);
					Object.assign(configOverrides, conflict.keys);
				}
			}
		},
		async closeBundle() {
			await optimize({
				inputDir: outputDir,
				inPlace: true,
				...pluginOptionsToOptimize(options),
				configOverrides:
					Object.keys(configOverrides).length > 0 ? configOverrides : undefined,
			});
		},
	};
}

export type { PageflarePluginOptions };
