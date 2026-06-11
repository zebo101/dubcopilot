// Server-only download jobs. Every link kind downloads into a per-job tmp dir
// first (yt-dlp for YouTube/Drive, plain fetch for OneDrive/direct links),
// then the browser streams the finished files and writes them into the
// user-chosen course folder. Job state lives on globalThis so all route
// modules see the same map across Next dev's per-route compilation.

import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import type { LinkKind } from "@/dub/course/link/parse";
import { oneDriveContentUrl } from "@/dub/course/link/parse";
import {
	ensureYtDlp,
	resolveProxy,
	run,
	ytDlpFormatArgs,
} from "@/dub/course/link/server/bin";

export type JobPhase = "starting" | "downloading" | "done" | "error";

export interface JobFile {
	name: string;
	size: number;
	kind: "video" | "subtitle";
}

export interface JobState {
	key: string;
	phase: JobPhase;
	downloaded: number;
	/** total bytes when known (yt-dlp estimate or Content-Length) */
	total: number | null;
	files: JobFile[];
	error: string | null;
	/** tmp dir on disk — never serialized to the client */
	dir: string;
}

const globalJobs = globalThis as typeof globalThis & {
	__ocLinkJobs?: Map<string, JobState>;
};
const jobs: Map<string, JobState> = (globalJobs.__ocLinkJobs ??= new Map());

const VIDEO_EXTS = new Set(["mp4", "mkv", "webm", "mov", "m4v"]);
const SUBTITLE_EXTS = new Set(["vtt", "srt"]);

export function getJob(key: string): JobState | null {
	return jobs.get(key) ?? null;
}

export async function cleanupJob(key: string): Promise<void> {
	const job = jobs.get(key);
	if (!job) return;
	jobs.delete(key);
	await rm(job.dir, { recursive: true, force: true }).catch(() => {});
}

/** Reject obvious SSRF targets — this proxy runs on the user's machine. */
export function isPrivateHost(hostname: string): boolean {
	const h = hostname.toLowerCase();
	if (h === "localhost" || h === "::1" || h.endsWith(".local")) return true;
	if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
	if (/^169\.254\./.test(h)) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
	return false;
}

async function collectFiles(dir: string): Promise<JobFile[]> {
	const names = await readdir(dir);
	const files: JobFile[] = [];
	for (const name of names) {
		if (name.endsWith(".part") || name.endsWith(".ytdl")) continue;
		const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
		const kind = VIDEO_EXTS.has(ext)
			? "video"
			: SUBTITLE_EXTS.has(ext)
				? "subtitle"
				: null;
		if (!kind) continue;
		const s = await stat(path.join(dir, name));
		files.push({ name, size: s.size, kind });
	}
	return files;
}

async function runYtDlp({
	job,
	url,
	proxy,
	subLangs,
}: {
	job: JobState;
	url: string;
	proxy?: string;
	subLangs?: string[];
}): Promise<void> {
	const bin = await ensureYtDlp({ proxy });
	const args = [
		"--no-playlist",
		...(await ytDlpFormatArgs()),
		"-o",
		path.join(job.dir, "video.%(ext)s"),
		"--newline",
		"--progress-template",
		"download:OCPROG %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s",
		"--no-mtime",
		...(proxy ? ["--proxy", proxy] : []),
		...(subLangs?.length
			? [
					"--write-subs",
					"--sub-langs",
					subLangs.join(","),
					"--convert-subs",
					"vtt",
				]
			: []),
		url,
	];
	const result = await run({
		cmd: bin,
		args,
		onStdoutLine: (line) => {
			if (!line.startsWith("OCPROG ")) return;
			const [downloaded, total, estimate] = line.slice(7).split(" ");
			const d = Number(downloaded);
			const t = Number(total) || Number(estimate);
			if (Number.isFinite(d)) job.downloaded = d;
			if (Number.isFinite(t) && t > 0) job.total = t;
		},
	});
	if (result.code !== 0) {
		throw new Error(
			result.stderr.split(/\r?\n/).filter(Boolean).slice(-3).join(" ") ||
				`yt-dlp 退出码 ${result.code}`,
		);
	}
}

function fileNameFromResponse({
	res,
	url,
}: {
	res: Response;
	url: string;
}): string {
	const cd = res.headers.get("content-disposition") ?? "";
	const star = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
	if (star) {
		try {
			return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
		} catch {
			/* fall through */
		}
	}
	const plain = cd.match(/filename="?([^";]+)"?/i);
	if (plain) return plain[1].trim();
	try {
		const last = new URL(url).pathname.split("/").filter(Boolean).pop();
		if (last) return decodeURIComponent(last);
	} catch {
		/* fall through */
	}
	return "download.mp4";
}

async function runFetch({
	job,
	url,
}: {
	job: JobState;
	url: string;
}): Promise<void> {
	const target = new URL(url);
	if (isPrivateHost(target.hostname)) {
		throw new Error("不支持内网/本机地址");
	}
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok || !res.body) {
		throw new Error(`上游响应 ${res.status}`);
	}
	const type = res.headers.get("content-type") ?? "";
	if (type.startsWith("text/html")) {
		throw new Error(
			"该链接返回的是网页而不是视频文件——请确认是直链，或检查云盘分享权限（任何人可查看）",
		);
	}
	const total = Number(res.headers.get("content-length"));
	if (Number.isFinite(total) && total > 0) job.total = total;

	const name = fileNameFromResponse({ res, url });
	const ext = name.includes(".")
		? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
		: "mp4";
	const outName = VIDEO_EXTS.has(ext) ? `video.${ext}` : "video.mp4";

	const counter = new Transform({
		transform(chunk: Buffer, _enc, cb) {
			job.downloaded += chunk.length;
			cb(null, chunk);
		},
	});
	await pipeline(
		Readable.fromWeb(
			res.body as unknown as import("node:stream/web").ReadableStream,
		),
		counter,
		createWriteStream(path.join(job.dir, outName)),
	);
}

/** Start a download job; progress is polled via getJob(). */
export async function startJob({
	key,
	kind,
	url,
	proxy: explicitProxy,
	subLangs,
}: {
	key: string;
	kind: LinkKind;
	url: string;
	proxy?: string;
	subLangs?: string[];
}): Promise<JobState> {
	const existing = jobs.get(key);
	if (existing) return existing;

	const job: JobState = {
		key,
		phase: "starting",
		downloaded: 0,
		total: null,
		files: [],
		error: null,
		dir: path.join(tmpdir(), `oc-link-${key}`),
	};
	jobs.set(key, job);

	const proxy = resolveProxy(explicitProxy);
	void (async () => {
		try {
			await mkdir(job.dir, { recursive: true });
			job.phase = "downloading";
			if (kind === "youtube" || kind === "gdrive") {
				await runYtDlp({ job, url, proxy, subLangs });
			} else {
				const fetchUrl = kind === "onedrive" ? oneDriveContentUrl(url) : url;
				try {
					await runFetch({ job, url: fetchUrl });
				} catch (fetchError) {
					// proxied networks (or odd servers) — let yt-dlp's generic
					// extractor retry before giving up
					job.downloaded = 0;
					await runYtDlp({ job, url: fetchUrl, proxy }).catch(() => {
						throw fetchError;
					});
				}
			}
			job.files = await collectFiles(job.dir);
			if (!job.files.some((f) => f.kind === "video")) {
				throw new Error("下载完成但没有视频文件");
			}
			job.phase = "done";
		} catch (error) {
			job.phase = "error";
			job.error = error instanceof Error ? error.message : String(error);
			console.error(`[dub/link] job ${key} failed:`, error);
		}
	})();

	return job;
}
