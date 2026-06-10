// Folder-first course import (no upload): pick a directory, walk it for video
// files, and pair each with its sibling subtitle (foo.mp4 ↔ foo.srt / foo_en.vtt
// / foo.en.srt …). Chrome / Edge only (File System Access API).

import { SUBTITLE_EXTENSIONS } from "@/dub/course/subtitles";
import { detectLangTag, stripLangTag } from "@/dub/languages";

const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "webm", "m4v", "avi"] as const;

declare global {
	interface Window {
		showDirectoryPicker?: (options?: {
			id?: string;
			mode?: "read" | "readwrite";
		}) => Promise<FileSystemDirectoryHandle>;
	}
}

/** Language code from dub/languages.ts, or "und" when the stem is untagged
 * (an untagged subtitle is treated as source language → goes through
 * translation). */
export type SubtitleLang = string;

export const UNTAGGED_LANG = "und";

export interface ScannedLesson {
	stem: string;
	title: string;
	chapter: string;
	videoPath: string;
	videoHandle: FileSystemFileHandle;
	subtitleHandle: FileSystemFileHandle | null;
	/** language of the paired subtitle: target language → use directly,
	 * anything else → translate. */
	subtitleLang: SubtitleLang | null;
}

export interface ScanResult {
	rootName: string;
	lessons: ScannedLesson[];
	withSubtitle: number;
	/** subset of withSubtitle already in the TARGET language (skip translation). */
	ready: number;
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

/** Strip a trailing language tag so "foo_en" / "foo.zh-cn" pair with "foo". */
function normalizeStem(stem: string): string {
	return stripLangTag(stem);
}

/** Detect the subtitle's language from its stem tag; untagged → "und". */
function detectSubtitleLang(stem: string): SubtitleLang {
	return detectLangTag(stem) ?? UNTAGGED_LANG;
}

/** Folder names that conventionally hold sidecar subtitles for their parent. */
const SUBTITLE_DIR_NAMES = new Set(["subs", "subtitles", "captions", "字幕"]);

export type SubtitleMap = Map<
	string,
	Record<SubtitleLang, FileSystemFileHandle>
>;

export function addSubtitleToMap({
	map,
	fileName,
	handle,
}: {
	map: SubtitleMap;
	fileName: string;
	handle: FileSystemFileHandle;
}): void {
	const rawStem = stemOf(fileName);
	const lang = detectSubtitleLang(rawStem);
	const key = normalizeStem(rawStem);
	const existing = map.get(key) ?? {};
	// first match per language wins (same-dir entries are added before subs/)
	if (!existing[lang]) existing[lang] = handle;
	map.set(key, existing);
}

/**
 * Pair each video with its best subtitle: one already in the TARGET language
 * (ready translation) wins, then an untagged sidecar, then English, then any
 * other tagged language; exact-stem match after tag stripping. Pure — testable.
 */
export function pairVideoWithSubtitles({
	videoName,
	subs,
	targetLang = "zh",
}: {
	videoName: string;
	subs: SubtitleMap;
	targetLang?: string;
}): { subtitleHandle: FileSystemFileHandle | null; subtitleLang: SubtitleLang | null } {
	const paired = subs.get(normalizeStem(stemOf(videoName))) ?? {};
	const candidates = [targetLang, UNTAGGED_LANG, "en", ...Object.keys(paired)];
	const subtitleLang = candidates.find((lang) => paired[lang]) ?? null;
	return {
		subtitleLang,
		subtitleHandle: subtitleLang ? paired[subtitleLang] : null,
	};
}

export async function scanCourseDirectory({
	dirHandle,
	targetLang = "zh",
}: {
	dirHandle: FileSystemDirectoryHandle;
	/** subtitles already in this language are paired as ready translations */
	targetLang?: string;
}): Promise<ScanResult> {
	const lessons: ScannedLesson[] = [];

	const walk = async (
		handle: FileSystemDirectoryHandle,
		relPath: string,
		chapter: string,
	): Promise<void> => {
		const videos: { name: string; handle: FileSystemFileHandle }[] = [];
		const subs: SubtitleMap = new Map();
		const subdirs: { name: string; handle: FileSystemDirectoryHandle }[] = [];

		for await (const [name, entry] of handle.entries()) {
			if (entry.kind === "file") {
				const e = extOf(name);
				if ((VIDEO_EXTENSIONS as readonly string[]).includes(e)) {
					videos.push({ name, handle: entry as FileSystemFileHandle });
				} else if ((SUBTITLE_EXTENSIONS as readonly string[]).includes(e)) {
					addSubtitleToMap({ map: subs, fileName: name, handle: entry as FileSystemFileHandle });
				}
			} else if (entry.kind === "directory") {
				subdirs.push({ name, handle: entry as FileSystemDirectoryHandle });
			}
		}

		// Course layouts often keep subtitles in a sibling subs/ folder
		// (e.g. 01-intro/video.mp4 + 01-intro/subs/video.en.srt) — merge those
		// into this directory's map so they pair with our videos.
		for (const d of subdirs) {
			if (!SUBTITLE_DIR_NAMES.has(d.name.toLowerCase())) continue;
			for await (const [name, entry] of d.handle.entries()) {
				if (
					entry.kind === "file" &&
					(SUBTITLE_EXTENSIONS as readonly string[]).includes(extOf(name))
				) {
					addSubtitleToMap({ map: subs, fileName: name, handle: entry as FileSystemFileHandle });
				}
			}
		}

		for (const v of videos) {
			const { subtitleHandle, subtitleLang } = pairVideoWithSubtitles({
				videoName: v.name,
				subs,
				targetLang,
			});
			lessons.push({
				stem: stemOf(v.name),
				title: stemOf(v.name),
				chapter: chapter || dirHandle.name,
				videoPath: relPath ? `${relPath}/${v.name}` : v.name,
				videoHandle: v.handle,
				subtitleHandle,
				subtitleLang,
			});
		}

		for (const d of subdirs) {
			// subtitle folders were consumed above — don't surface their videos
			if (SUBTITLE_DIR_NAMES.has(d.name.toLowerCase())) continue;
			await walk(d.handle, relPath ? `${relPath}/${d.name}` : d.name, d.name);
		}
	};

	await walk(dirHandle, "", "");

	lessons.sort((a, b) =>
		a.videoPath.localeCompare(b.videoPath, undefined, { numeric: true }),
	);

	const withSubtitle = lessons.filter((l) => l.subtitleHandle).length;
	const ready = lessons.filter((l) => l.subtitleLang === targetLang).length;
	return {
		rootName: dirHandle.name,
		lessons,
		withSubtitle,
		ready,
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
