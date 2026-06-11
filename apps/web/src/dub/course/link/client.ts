// Browser side of link import: drive a server download job per item, then
// stream the finished files straight into the user-chosen course folder
// (File System Access API). After all items land, the normal folder scan
// takes over — downstream pipeline/export sees no difference from a local
// import.

import { sanitizeFileName } from "@/dub/course/link/parse";
import type { LinkItem } from "@/dub/course/link/types";

const VIDEO_EXTS = ["mp4", "webm", "mkv", "mov", "m4v"];

export type TaskStatus =
	| "pending"
	| "downloading"
	| "writing"
	| "done"
	| "skipped"
	| "error";

export interface DownloadTask {
	item: LinkItem;
	/** 1-based paste/playlist order — becomes the "001 - " filename prefix */
	index: number;
	status: TaskStatus;
	/** 0–100, or null while the size is unknown */
	pct: number | null;
	downloadedBytes: number;
	error: string | null;
}

interface JobStatePublic {
	phase: "starting" | "downloading" | "done" | "error";
	downloaded: number;
	total: number | null;
	files: { name: string; size: number; kind: "video" | "subtitle" }[];
	error: string | null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function fileExists({
	dirHandle,
	name,
}: {
	dirHandle: FileSystemDirectoryHandle;
	name: string;
}): Promise<boolean> {
	try {
		await dirHandle.getFileHandle(name);
		return true;
	} catch {
		return false;
	}
}

/** Stream into "<name>.part", then rename — a final-named file is always
 * complete, which is what makes interrupted imports safely resumable. */
async function writeStreamToDir({
	dirHandle,
	name,
	stream,
}: {
	dirHandle: FileSystemDirectoryHandle;
	name: string;
	stream: ReadableStream<Uint8Array>;
}): Promise<void> {
	const partName = `${name}.part`;
	const partHandle = await dirHandle.getFileHandle(partName, { create: true });
	const writable = await partHandle.createWritable();
	await stream.pipeTo(writable); // closes the writable
	const movable = partHandle as FileSystemFileHandle & {
		move?: (newName: string) => Promise<void>;
	};
	if (typeof movable.move === "function") {
		await movable.move(name);
		return;
	}
	// older browsers: streaming copy + delete the .part
	const finalHandle = await dirHandle.getFileHandle(name, { create: true });
	const finalWritable = await finalHandle.createWritable();
	const partFile = await partHandle.getFile();
	await partFile.stream().pipeTo(finalWritable);
	await dirHandle.removeEntry(partName);
}

/** "video.en.vtt" → "en"; "video.vtt" → null. */
function subtitleLangOf(name: string): string | null {
	const parts = name.split(".");
	return parts.length >= 3 ? parts[parts.length - 2] : null;
}

export async function downloadOne({
	task,
	dirHandle,
	proxy,
	subLangs,
	onUpdate,
}: {
	task: DownloadTask;
	dirHandle: FileSystemDirectoryHandle;
	proxy?: string;
	subLangs?: string[];
	onUpdate: (patch: Partial<DownloadTask>) => void;
}): Promise<void> {
	const { item, index } = task;
	const stem = `${String(index).padStart(3, "0")} - ${
		sanitizeFileName(item.title) || `video_${index}`
	}`;

	// resumable skip: a final-named video file means a completed earlier run
	for (const ext of VIDEO_EXTS) {
		if (await fileExists({ dirHandle, name: `${stem}.${ext}` })) {
			onUpdate({ status: "skipped", pct: 100 });
			return;
		}
	}

	onUpdate({ status: "downloading", pct: item.sizeBytes ? 0 : null });

	const startRes = await fetch("/api/dub/link/jobs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			key: item.key,
			kind: item.kind,
			url: item.url,
			...(proxy ? { proxy } : {}),
			...(item.kind === "youtube" && subLangs?.length ? { subLangs } : {}),
		}),
	});
	if (!startRes.ok) {
		const detail = await startRes.json().catch(() => null);
		throw new Error(
			(detail as { error?: string })?.error ?? `启动下载失败 ${startRes.status}`,
		);
	}

	// poll the job until the server-side download finishes (0–90%)
	let job: JobStatePublic;
	for (;;) {
		await sleep(700);
		const res = await fetch(`/api/dub/link/jobs/${item.key}`);
		if (!res.ok) throw new Error(`查询进度失败 ${res.status}`);
		job = (await res.json()) as JobStatePublic;
		if (job.phase === "error") throw new Error(job.error ?? "下载失败");
		onUpdate({
			downloadedBytes: job.downloaded,
			pct: job.total ? Math.min(90, (job.downloaded / job.total) * 90) : null,
		});
		if (job.phase === "done") break;
	}

	// stream files into the course folder (90–100%)
	onUpdate({ status: "writing", pct: 90 });
	const videoFile = job.files.find((f) => f.kind === "video");
	if (!videoFile) throw new Error("任务完成但没有视频文件");
	for (const file of job.files) {
		const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
		const lang = file.kind === "subtitle" ? subtitleLangOf(file.name) : null;
		const target =
			file.kind === "video"
				? `${stem}.${ext}`
				: `${stem}${lang ? `_${lang}` : ""}.${ext}`;
		const res = await fetch(
			`/api/dub/link/jobs/${item.key}/file?name=${encodeURIComponent(file.name)}`,
		);
		if (!res.ok || !res.body) throw new Error(`取件失败 ${res.status}`);
		await writeStreamToDir({ dirHandle, name: target, stream: res.body });
	}

	await fetch(`/api/dub/link/jobs/${item.key}`, { method: "DELETE" }).catch(
		() => {},
	);
	onUpdate({ status: "done", pct: 100 });
}

/** Run tasks with a small worker pool (server downloads + disk writes). */
export async function runDownloadPool({
	tasks,
	concurrency = 2,
	worker,
}: {
	tasks: DownloadTask[];
	concurrency?: number;
	worker: (task: DownloadTask) => Promise<void>;
}): Promise<void> {
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
			while (next < tasks.length) {
				const task = tasks[next];
				next += 1;
				await worker(task);
			}
		}),
	);
}

export function formatBytes(bytes: number | null): string {
	if (!bytes || bytes <= 0) return "—";
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
	return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
