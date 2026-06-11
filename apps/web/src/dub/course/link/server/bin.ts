// Server-only: locate (or auto-install) the yt-dlp binary and detect ffmpeg.
// Lookup order: apps/web/.bin → PATH → download from the GitHub latest release
// (via curl so --proxy works; plain fetch as fallback). Node runtime only.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const BIN_DIR = path.join(process.cwd(), ".bin");
const YT_DLP_NAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const RELEASE_ASSET =
	process.platform === "win32"
		? "yt-dlp.exe"
		: process.platform === "darwin"
			? "yt-dlp_macos"
			: "yt-dlp";
const RELEASE_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${RELEASE_ASSET}`;

export function resolveProxy(explicit?: string): string | undefined {
	const candidate =
		explicit?.trim() ||
		process.env.HTTPS_PROXY ||
		process.env.https_proxy ||
		process.env.HTTP_PROXY ||
		process.env.http_proxy ||
		process.env.ALL_PROXY;
	return candidate || undefined;
}

export interface RunResult {
	code: number;
	stdout: string;
	stderr: string;
}

/** Spawn a process and collect its output (no shell). */
export function run({
	cmd,
	args,
	onStdoutLine,
}: {
	cmd: string;
	args: string[];
	onStdoutLine?: (line: string) => void;
}): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { windowsHide: true });
		let stdout = "";
		let stderr = "";
		let buffer = "";
		child.stdout.on("data", (d: Buffer) => {
			const text = d.toString("utf8");
			stdout += text;
			if (!onStdoutLine) return;
			buffer += text;
			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() ?? "";
			for (const line of lines) onStdoutLine(line);
		});
		child.stderr.on("data", (d: Buffer) => {
			stderr += d.toString("utf8");
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (buffer && onStdoutLine) onStdoutLine(buffer);
			resolve({ code: code ?? -1, stdout, stderr });
		});
	});
}

async function commandWorks(cmd: string): Promise<boolean> {
	// yt-dlp wants --version, ffmpeg wants -version — accept either
	for (const flag of ["--version", "-version"]) {
		try {
			const r = await run({ cmd, args: [flag] });
			if (r.code === 0) return true;
		} catch {
			return false; // ENOENT — not installed
		}
	}
	return false;
}

let ffmpegCache: boolean | null = null;

/** ffmpeg on PATH? Without it YouTube falls back to progressive ≤720p mp4. */
export async function hasFfmpeg(): Promise<boolean> {
	if (ffmpegCache === null) ffmpegCache = await commandWorks("ffmpeg");
	return ffmpegCache;
}

async function downloadBinary({ proxy }: { proxy?: string }): Promise<string> {
	await mkdir(BIN_DIR, { recursive: true });
	const target = path.join(BIN_DIR, YT_DLP_NAME);
	const partial = `${target}.part`;

	// curl ships with Windows 10+/macOS/most Linux and honors --proxy
	const curlArgs = [
		"-L",
		"--fail",
		"--silent",
		"--show-error",
		...(proxy ? ["--proxy", proxy] : []),
		"-o",
		partial,
		RELEASE_URL,
	];
	let lastError = "";
	try {
		const r = await run({ cmd: "curl", args: curlArgs });
		if (r.code !== 0) lastError = r.stderr.slice(-300);
	} catch (error) {
		lastError = String(error);
	}

	if (lastError) {
		// fetch fallback (no proxy support — works when the network is direct)
		try {
			const res = await fetch(RELEASE_URL, { redirect: "follow" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			await writeFile(partial, Buffer.from(await res.arrayBuffer()));
			lastError = "";
		} catch (error) {
			throw new Error(
				`yt-dlp 自动下载失败（${lastError || String(error)}）。请检查代理设置，` +
					`或手动下载 ${RELEASE_URL} 放到 apps/web/.bin/${YT_DLP_NAME}`,
			);
		}
	}

	await rename(partial, target);
	if (process.platform !== "win32") await chmod(target, 0o755);
	return target;
}

let ytDlpCache: string | null = null;

/** Path (or PATH command) of a usable yt-dlp, downloading it if needed. */
export async function ensureYtDlp({
	proxy,
}: {
	proxy?: string;
}): Promise<string> {
	if (ytDlpCache) return ytDlpCache;
	const local = path.join(BIN_DIR, YT_DLP_NAME);
	if (existsSync(local)) {
		ytDlpCache = local;
	} else if (await commandWorks("yt-dlp")) {
		ytDlpCache = "yt-dlp";
	} else {
		ytDlpCache = await downloadBinary({ proxy });
	}
	return ytDlpCache;
}

/** Format selector: merged best with ffmpeg, progressive mp4 without. */
export async function ytDlpFormatArgs(): Promise<string[]> {
	if (await hasFfmpeg()) {
		return [
			"-f",
			"bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
			"--merge-output-format",
			"mp4",
		];
	}
	return ["-f", "b[ext=mp4]/b"];
}
