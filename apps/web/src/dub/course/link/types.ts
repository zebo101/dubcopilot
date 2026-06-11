import type { LinkKind } from "@/dub/course/link/parse";

/** One downloadable item produced by /api/dub/link/resolve. */
export interface LinkItem {
	/** stable id — also the download job key */
	key: string;
	kind: LinkKind;
	/** concrete URL to download (playlist entries → individual watch URLs) */
	url: string;
	title: string;
	sizeBytes: number | null;
	durationSec: number | null;
	/** manual-subtitle languages reported by yt-dlp (YouTube only) */
	subtitles: string[];
	/** resolve-time failure — item can't be downloaded */
	error: string | null;
}

export interface ResolveResponse {
	items: LinkItem[];
	/** ffmpeg missing on the server → YouTube limited to progressive ≤720p */
	ffmpegMissing: boolean;
}
