// Folder-first course import (no upload): pick a directory, walk it for video
// files, and pair each with its sibling subtitle (foo.mp4 ↔ foo.srt / foo_en.vtt
// / foo.en.srt …). Chrome / Edge only (File System Access API).

import { SUBTITLE_EXTENSIONS } from "@/dub/course/subtitles";

const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "webm", "m4v", "avi"] as const;

declare global {
	interface Window {
		showDirectoryPicker?: (options?: {
			id?: string;
			mode?: "read" | "readwrite";
		}) => Promise<FileSystemDirectoryHandle>;
	}
}

export interface ScannedLesson {
	stem: string;
	title: string;
	chapter: string;
	videoPath: string;
	videoHandle: FileSystemFileHandle;
	subtitleHandle: FileSystemFileHandle | null;
}

export interface ScanResult {
	rootName: string;
	lessons: ScannedLesson[];
	withSubtitle: number;
	missing: number;
}

export function isFolderImportSupported(): boolean {
	return typeof window !== "undefined" && !!window.showDirectoryPicker;
}

/** Open the OS folder picker (read-write so we can later write _localized). */
export async function pickCourseDirectory(): Promise<FileSystemDirectoryHandle | null> {
	if (!isFolderImportSupported()) {
		throw new Error("当前浏览器不支持本地文件夹访问，请使用 Chrome / Edge");
	}
	try {
		return await window.showDirectoryPicker?.({
			id: "opencut-course",
			mode: "readwrite",
		}) ?? null;
	} catch {
		return null; // user cancelled the picker
	}
}

function extOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function stemOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot === -1 ? name : name.slice(0, dot);
}

/** Strip a trailing language tag so "foo_en" / "foo.en" pairs with "foo". */
function normalizeStem(stem: string): string {
	return stem.toLowerCase().replace(/[_.\-](en|eng|english)$/, "");
}

export async function scanCourseDirectory({
	dirHandle,
}: {
	dirHandle: FileSystemDirectoryHandle;
}): Promise<ScanResult> {
	const lessons: ScannedLesson[] = [];

	const walk = async (
		handle: FileSystemDirectoryHandle,
		relPath: string,
		chapter: string,
	): Promise<void> => {
		const videos: { name: string; handle: FileSystemFileHandle }[] = [];
		const subs = new Map<string, FileSystemFileHandle>();
		const subdirs: { name: string; handle: FileSystemDirectoryHandle }[] = [];

		for await (const [name, entry] of handle.entries()) {
			if (entry.kind === "file") {
				const e = extOf(name);
				if ((VIDEO_EXTENSIONS as readonly string[]).includes(e)) {
					videos.push({ name, handle: entry as FileSystemFileHandle });
				} else if ((SUBTITLE_EXTENSIONS as readonly string[]).includes(e)) {
					subs.set(normalizeStem(stemOf(name)), entry as FileSystemFileHandle);
				}
			} else if (entry.kind === "directory") {
				subdirs.push({ name, handle: entry as FileSystemDirectoryHandle });
			}
		}

		for (const v of videos) {
			const stem = stemOf(v.name);
			const subtitleHandle = subs.get(normalizeStem(stem)) ?? null;
			lessons.push({
				stem,
				title: stem,
				chapter: chapter || dirHandle.name,
				videoPath: relPath ? `${relPath}/${v.name}` : v.name,
				videoHandle: v.handle,
				subtitleHandle,
			});
		}

		for (const d of subdirs) {
			await walk(d.handle, relPath ? `${relPath}/${d.name}` : d.name, d.name);
		}
	};

	await walk(dirHandle, "", "");

	lessons.sort((a, b) =>
		a.videoPath.localeCompare(b.videoPath, undefined, { numeric: true }),
	);

	const withSubtitle = lessons.filter((l) => l.subtitleHandle).length;
	return {
		rootName: dirHandle.name,
		lessons,
		withSubtitle,
		missing: lessons.length - withSubtitle,
	};
}

/** Re-acquire read/write permission on a persisted handle (resume flow). */
export async function ensurePermission({
	handle,
}: {
	handle: FileSystemHandle & {
		queryPermission?: (d: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
		requestPermission?: (d: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
	};
}): Promise<boolean> {
	const opts = { mode: "readwrite" as const };
	if (!handle.queryPermission) return true;
	if ((await handle.queryPermission(opts)) === "granted") return true;
	if (!handle.requestPermission) return false;
	return (await handle.requestPermission(opts)) === "granted";
}
