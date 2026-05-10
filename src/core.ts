import { execSync, spawn } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────

export interface OptimizeOptions {
	inputDir: string;
	inPlace?: boolean;
	output?: string;
	platform?: "auto" | "vercel" | "netlify" | "cloudflare-pages" | "none";
	config?: string;
	force?: boolean;
	json?: boolean;
	log?: "off" | "error" | "warn" | "info" | "debug";
	args?: string[];
	configOverrides?: Record<string, unknown>;

	// --- v0.9 CLI surface -------------------------------------------

	/** Wipe the output directory before writing. Refuses when output equals input. */
	cleanOutput?: boolean;
	/** Production build — enables platform CDN image rewrites. */
	prod?: boolean;
	/** Force the heuristic fallback path (no browser-driven extraction). */
	noBrowser?: boolean;
	/** Generate sitemap.xml, robots.txt, llms.txt, .well-known agent/MCP cards, etc. */
	withGeo?: boolean;
	/** Inject viewport / charset / canonical / basic OG tags into HTML when missing. */
	withSeo?: boolean;
	/** Run audit checks during the build, emit audit.json. */
	withAudit?: boolean;
	/** Run PWA build (manifest, service worker, icons) after the main pipeline. */
	withPwa?: boolean;
	/** Exit non-zero on internal 404 references. */
	failOnBrokenRefs?: boolean;
}

export interface PageflarePluginOptions {
	platform?: OptimizeOptions["platform"];
	args?: string[];
	log?: OptimizeOptions["log"];
	configOverrides?: Record<string, unknown>;

	// --- v0.9 CLI surface, exposed to framework users ---------------
	cleanOutput?: OptimizeOptions["cleanOutput"];
	prod?: OptimizeOptions["prod"];
	noBrowser?: OptimizeOptions["noBrowser"];
	withGeo?: OptimizeOptions["withGeo"];
	withSeo?: OptimizeOptions["withSeo"];
	withAudit?: OptimizeOptions["withAudit"];
	withPwa?: OptimizeOptions["withPwa"];
	failOnBrokenRefs?: OptimizeOptions["failOnBrokenRefs"];
}

/**
 * Map plugin options (the user-facing shape framework integrations expose) to
 * the subset of OptimizeOptions accepted by `optimize()`. Keeps the per-
 * integration adapters (vite/nuxt/astro/next/netlify) DRY — they each spread
 * the result and add their own `inputDir`, `inPlace`, `configOverrides`.
 */
export function pluginOptionsToOptimize(
	opts: PageflarePluginOptions | undefined,
): Omit<OptimizeOptions, "inputDir"> {
	return {
		platform: opts?.platform,
		log: opts?.log,
		args: opts?.args,
		cleanOutput: opts?.cleanOutput,
		prod: opts?.prod,
		noBrowser: opts?.noBrowser,
		withGeo: opts?.withGeo,
		withSeo: opts?.withSeo,
		withAudit: opts?.withAudit,
		withPwa: opts?.withPwa,
		failOnBrokenRefs: opts?.failOnBrokenRefs,
	};
}

// ── JSONC / config helpers ─────────────────────────────────────────

/**
 * Strip JSONC comments (// and /* ... *\/) while preserving
 * comment-like content inside quoted strings.
 */
function stripJsoncComments(text: string): string {
	let result = "";
	let i = 0;
	while (i < text.length) {
		// Quoted string — copy verbatim
		if (text[i] === '"') {
			result += '"';
			i++;
			while (i < text.length) {
				if (text[i] === "\\" && i + 1 < text.length) {
					result += text[i] + text[i + 1];
					i += 2;
				} else if (text[i] === '"') {
					result += '"';
					i++;
					break;
				} else {
					result += text[i];
					i++;
				}
			}
		} else if (i + 1 < text.length && text[i] === "/" && text[i + 1] === "/") {
			// Single-line comment — skip to end of line
			while (i < text.length && text[i] !== "\n") i++;
		} else if (i + 1 < text.length && text[i] === "/" && text[i + 1] === "*") {
			// Multi-line comment — skip to closing */
			i += 2;
			while (i + 1 < text.length && !(text[i] === "*" && text[i + 1] === "/"))
				i++;
			if (i + 1 < text.length) i += 2;
		} else {
			result += text[i];
			i++;
		}
	}
	return result;
}

function resolveUserConfig(
	inputDir: string,
	explicitConfig?: string,
): string | null {
	if (explicitConfig) {
		return existsSync(explicitConfig) ? explicitConfig : null;
	}
	let dir = resolve(inputDir);
	for (let i = 0; i < 4; i++) {
		const candidate = join(dir, "pageflare.jsonc");
		if (existsSync(candidate)) return candidate;
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

function mergeConfigOverrides(
	inputDir: string,
	explicitConfig: string | undefined,
	overrides: Record<string, unknown>,
): string {
	const userConfigPath = resolveUserConfig(inputDir, explicitConfig);
	let base: Record<string, unknown> = {};
	if (userConfigPath) {
		try {
			const raw = readFileSync(userConfigPath, "utf8");
			base = JSON.parse(stripJsoncComments(raw));
		} catch (err) {
			console.warn(
				`[pageflare] Failed to parse ${userConfigPath}, using defaults: ${err instanceof Error ? err.message : err}`,
			);
		}
	}
	const merged = { ...base, ...overrides };
	const tmpDir = mkdtempSync(join(tmpdir(), "pageflare-"));
	const tmpConfig = join(tmpDir, "pageflare.jsonc");
	writeFileSync(tmpConfig, JSON.stringify(merged, null, 2));
	return tmpConfig;
}

// ── Binary resolution ──────────────────────────────────────────────

function resolveFromCli(): string | null {
	try {
		const require = createRequire(import.meta.url);
		// @pageflare/cli is a direct dependency — resolve its bin entry
		const cliPkg = require.resolve("@pageflare/cli/package.json");
		const binPath = join(cliPkg, "..", "bin", "cli.js");
		if (existsSync(binPath)) return binPath;
	} catch {}
	return null;
}

function resolveCached(): string | null {
	const binPath = join(homedir(), ".pageflare", "bin", "pageflare");
	return existsSync(binPath) ? binPath : null;
}

function resolveFromPath(): string | null {
	const cmd = process.platform === "win32" ? "where" : "which";
	try {
		const result = execSync(`${cmd} pageflare`, { encoding: "utf8" }).trim();
		if (result && existsSync(result)) return result;
	} catch {}
	return null;
}

export async function resolveBinary(): Promise<string> {
	// 1. @pageflare/cli (direct dependency — handles platform binary internally)
	const cliBin = resolveFromCli();
	if (cliBin) return cliBin;

	// 2. Cached install (~/.pageflare/bin/)
	const cached = resolveCached();
	if (cached) return cached;

	// 3. PATH
	const pathBin = resolveFromPath();
	if (pathBin) return pathBin;

	throw new Error(
		"Could not find pageflare binary.\n" +
			"Install manually:\n" +
			"  npm install @pageflare/cli\n" +
			"  # or\n" +
			"  curl -fsSL https://get.appz.dev/pageflare/install.sh | sh",
	);
}

// ── Execution ──────────────────────────────────────────────────────

export async function optimize(options: OptimizeOptions): Promise<void> {
	const binary = await resolveBinary();

	let tmpConfigPath: string | undefined;
	if (
		options.configOverrides &&
		Object.keys(options.configOverrides).length > 0
	) {
		tmpConfigPath = mergeConfigOverrides(
			options.inputDir,
			options.config,
			options.configOverrides,
		);
		options.config = tmpConfigPath;
	}

	const args: string[] = [options.inputDir];

	// CLI no longer has an --in-place flag — passing the same path for
	// --output overwrites files in the build directory, which is what
	// framework integrations want by default. Explicit options.output
	// always wins.
	if (options.output) {
		args.push("--output", options.output);
	} else if (options.inPlace !== false) {
		args.push("--output", options.inputDir);
	}
	if (options.platform) args.push("--platform", options.platform);
	if (options.config) args.push("--config", options.config);
	if (options.force) args.push("--force");
	if (options.json) args.push("--json");
	if (options.cleanOutput) args.push("--clean-output");
	if (options.prod) args.push("--prod");
	if (options.noBrowser) args.push("--no-browser");
	if (options.withGeo) args.push("--with-geo");
	if (options.withSeo) args.push("--with-seo");
	if (options.withAudit) args.push("--with-audit");
	if (options.withPwa) args.push("--with-pwa");
	if (options.failOnBrokenRefs) args.push("--fail-on-broken-refs");
	if (options.log) args.push("--log", options.log);
	if (options.args) args.push(...options.args);

	const cleanup = () => {
		if (tmpConfigPath) {
			try {
				rmSync(resolve(tmpConfigPath, ".."), { recursive: true, force: true });
			} catch {}
		}
	};

	return new Promise<void>((resolve, reject) => {
		const child = spawn(binary, args, { stdio: "inherit" });
		child.on("close", (code) => {
			cleanup();
			if (code === 0) resolve();
			else reject(new Error(`pageflare exited with code ${code}`));
		});
		child.on("error", (err) => {
			cleanup();
			reject(err);
		});
	});
}
