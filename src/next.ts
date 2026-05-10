import { resolve } from "node:path";
import type { NextConfig } from "next";
import {
	optimize,
	type PageflarePluginOptions,
	pluginOptionsToOptimize,
} from "./core.js";

/**
 * Config wrapper that validates Next.js is in export mode.
 * Does NOT hook into the build — users chain via npm scripts:
 *   "build": "next build && pageflare out/"
 */
export default function withPageflare(_options?: PageflarePluginOptions) {
	return (nextConfig: NextConfig = {}): NextConfig => {
		if (nextConfig.output !== "export") {
			console.warn(
				'[pageflare] Next.js integration only supports `output: "export"` mode. ' +
					'Add `output: "export"` to your Next.js config, or run `pageflare out/` manually.',
			);
		}
		return nextConfig;
	};
}

/**
 * Programmatic API for use in custom build scripts.
 *
 * Usage:
 *   // scripts/build.mjs
 *   import { optimizeNextExport } from 'pageflare/next'
 *   await optimizeNextExport()
 */
export async function optimizeNextExport(
	options?: PageflarePluginOptions & { outputDir?: string },
): Promise<void> {
	const outputDir = resolve(process.cwd(), options?.outputDir || "out");
	await optimize({
		inputDir: outputDir,
		inPlace: true,
		...pluginOptionsToOptimize(options),
		configOverrides: options?.configOverrides,
	});
}

export type { PageflarePluginOptions };
