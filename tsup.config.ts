import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		core: "src/core.ts",
		vite: "src/vite.ts",
		nuxt: "src/nuxt.ts",
		astro: "src/astro.ts",
		next: "src/next.ts",
		netlify: "src/netlify.ts",
	},
	format: ["esm"],
	target: "node20",
	splitting: true,
	dts: true,
	clean: true,
	external: [
		"vite",
		"astro",
		"@nuxt/kit",
		"@nuxt/schema",
		"nitropack",
		"nitro",
		"next",
	],
});
