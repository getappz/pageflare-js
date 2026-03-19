import { optimize } from "./core.js";

interface NetlifyConstants {
	PUBLISH_DIR: string;
}

interface NetlifyCache {
	restore(path: string): Promise<boolean>;
	save(path: string): Promise<boolean>;
}

interface NetlifyBuild {
	failBuild(message: string, opts?: { error: unknown }): void;
}

interface NetlifyStatus {
	show(opts: { title?: string; summary: string }): void;
}

interface NetlifyInputs {
	args?: string;
}

interface OnPostBuildArgs {
	constants: NetlifyConstants;
	utils: {
		cache: NetlifyCache;
		build: NetlifyBuild;
		status: NetlifyStatus;
	};
	inputs: NetlifyInputs;
}

export async function onPostBuild({
	constants,
	utils,
	inputs,
}: OnPostBuildArgs): Promise<void> {
	const { PUBLISH_DIR } = constants;
	const { cache, build, status } = utils;

	try {
		// Restore cached binary — shared resolveBinary() will find it at ~/.pageflare/bin/
		await cache.restore(`${process.env.HOME}/.pageflare`);

		const customArgs = inputs.args
			? inputs.args.split(/\s+/).filter(Boolean)
			: [];

		await optimize({
			inputDir: PUBLISH_DIR,
			inPlace: true,
			platform: "netlify",
			args: customArgs,
		});

		await cache.save(`${process.env.HOME}/.pageflare`);
		status.show({
			title: "Pageflare",
			summary: "Site optimized for PageSpeed",
		});
	} catch (error) {
		build.failBuild("Pageflare optimization failed", { error });
	}
}
