import { execSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
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

// ── Platform map ───────────────────────────────────────────────────

const PLATFORMS: Record<string, string> = {
	"linux-x64-glibc": "@pageflare/cli-linux-x64",
	"linux-x64-musl": "@pageflare/cli-linux-x64-musl",
	"linux-arm64-glibc": "@pageflare/cli-linux-arm64",
	"linux-arm64-musl": "@pageflare/cli-linux-arm64-musl",
	"darwin-x64": "@pageflare/cli-darwin-x64",
	"darwin-arm64": "@pageflare/cli-darwin-arm64",
	"win32-x64": "@pageflare/cli-win32-x64",
};

// ── Libc detection (Linux only) ────────────────────────────────────

function detectLibc(): string {
	if (process.platform !== "linux") return "";
	try {
		const libs = readdirSync("/lib");
		if (libs.some((f) => f.startsWith("ld-musl-"))) return "musl";
	} catch {}
	try {
		const out = execSync("ldd --version 2>&1", { encoding: "utf8" });
		if (out.toLowerCase().includes("musl")) return "musl";
	} catch {}
	return "glibc";
}

// ── Binary resolution ──────────────────────────────────────────────

function getPlatformKey(): string {
	const { platform, arch } = process;
	return platform === "linux"
		? `${platform}-${arch}-${detectLibc()}`
		: `${platform}-${arch}`;
}

function resolveFromNodeModules(): string | null {
	const key = getPlatformKey();
	const pkg = PLATFORMS[key];
	if (!pkg) return null;

	const binaryName =
		process.platform === "win32" ? "pageflare.exe" : "pageflare";
	try {
		const require = createRequire(import.meta.url);
		const pkgDir = require.resolve(`${pkg}/package.json`);
		const binPath = join(pkgDir, "..", "bin", binaryName);
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

async function downloadBinary(): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const isWindows = process.platform === "win32";
		const cmd = isWindows ? "powershell" : "sh";
		const args = isWindows
			? ["-Command", "irm https://get.appz.dev/pageflare/install.ps1 | iex"]
			: ["-c", "curl -fsSL https://get.appz.dev/pageflare/install.sh | sh"];

		const child = spawn(cmd, args, { stdio: "inherit" });
		child.on("close", (code) => {
			if (code === 0) resolve();
			else
				reject(
					new Error(
						`Failed to download pageflare binary (exit code ${code}).\n` +
							"Install manually:\n" +
							"  npm install @pageflare/cli\n" +
							"  # or\n" +
							"  curl -fsSL https://get.appz.dev/pageflare/install.sh | sh",
					),
				);
		});
		child.on("error", (err) => reject(err));
	});
}

export async function resolveBinary(): Promise<string> {
	// 1. npm optional deps
	const npmBin = resolveFromNodeModules();
	if (npmBin) return npmBin;

	// 2. Cached install
	const cached = resolveCached();
	if (cached) return cached;

	// 3. PATH
	const pathBin = resolveFromPath();
	if (pathBin) return pathBin;

	// 4. Auto-download
	await downloadBinary();
	const downloaded = resolveCached();
	if (downloaded) return downloaded;

	throw new Error(
		"Could not find or install pageflare binary.\n" +
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
