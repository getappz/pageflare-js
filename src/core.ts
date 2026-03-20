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
}

export interface PageflarePluginOptions {
	platform?: OptimizeOptions["platform"];
	args?: string[];
	log?: OptimizeOptions["log"];
	configOverrides?: Record<string, unknown>;
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

	if (options.inPlace !== false) args.push("--in-place");
	if (options.output) args.push("--output", options.output);
	if (options.platform) args.push("--platform", options.platform);
	if (options.config) args.push("--config", options.config);
	if (options.force) args.push("--force");
	if (options.json) args.push("--json");
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
