import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

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
}

export interface PageflarePluginOptions {
	platform?: OptimizeOptions["platform"];
	args?: string[];
	log?: OptimizeOptions["log"];
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

	const args: string[] = [options.inputDir];

	if (options.inPlace !== false) args.push("--in-place");
	if (options.output) args.push("--output", options.output);
	if (options.platform) args.push("--platform", options.platform);
	if (options.config) args.push("--config", options.config);
	if (options.force) args.push("--force");
	if (options.json) args.push("--json");
	if (options.log) args.push("--log", options.log);
	if (options.args) args.push(...options.args);

	return new Promise<void>((resolve, reject) => {
		const child = spawn(binary, args, { stdio: "inherit" });
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`pageflare exited with code ${code}`));
		});
		child.on("error", (err) => reject(err));
	});
}
