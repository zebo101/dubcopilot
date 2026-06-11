// Link-import URL classification — pure functions shared by client and server.
// Decides which download backend handles a pasted URL; the API routes do the
// actual resolving/downloading.

export type LinkKind =
	| "youtube"
	| "youtube-playlist"
	| "gdrive"
	| "gdrive-folder"
	| "onedrive"
	| "direct";

export interface ParsedLink {
	kind: LinkKind;
	url: string;
}

const YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"music.youtube.com",
]);

const ONEDRIVE_HOSTS = new Set([
	"1drv.ms",
	"onedrive.live.com",
	"my.microsoftpersonalcontent.com",
]);

export function classifyLink(raw: string): ParsedLink | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	const host = url.hostname.toLowerCase();

	if (host === "youtu.be") return { kind: "youtube", url: trimmed };
	if (YOUTUBE_HOSTS.has(host)) {
		if (url.pathname === "/playlist" && url.searchParams.get("list")) {
			return { kind: "youtube-playlist", url: trimmed };
		}
		// watch / shorts / live / embed — anything else (channels…) is rejected
		// with a clear message at resolve time rather than guessed here.
		return { kind: "youtube", url: trimmed };
	}

	if (host === "drive.google.com" || host === "docs.google.com") {
		if (/\/(?:drive\/)?(?:u\/\d+\/)?folders\//.test(url.pathname)) {
			return { kind: "gdrive-folder", url: trimmed };
		}
		return { kind: "gdrive", url: trimmed };
	}

	if (ONEDRIVE_HOSTS.has(host) || host.endsWith(".sharepoint.com")) {
		return { kind: "onedrive", url: trimmed };
	}

	return { kind: "direct", url: trimmed };
}

/** File id from a Drive share link (/file/d/{id}, ?id=, /uc?id=). */
export function extractGDriveFileId(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	const m = parsed.pathname.match(/\/file\/d\/([^/]+)/);
	if (m) return m[1];
	return parsed.searchParams.get("id");
}

/**
 * OneDrive share link → unauthenticated content URL (the shares API answers
 * a 302 to a pre-signed download for "anyone with the link" shares).
 * Encoding per MS docs: base64url with the trailing "=" stripped, "u!" prefix.
 */
export function oneDriveContentUrl(shareUrl: string): string {
	const b64 = btoa(shareUrl)
		.replace(/=+$/, "")
		.replace(/\//g, "_")
		.replace(/\+/g, "-");
	return `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`;
}

const WINDOWS_RESERVED = /[\\/:*?"<>|\u0000-\u001f]/g;

/** Windows-safe file name: strip reserved characters, collapse whitespace. */
export function sanitizeFileName(name: string): string {
	return name
		.replace(WINDOWS_RESERVED, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[. ]+$/, "")
		.slice(0, 120);
}

/** "001 - Title.mp4" — paste/playlist order becomes the course order
 * (the scanner sorts by name with numeric collation). */
export function lessonFileName({
	index,
	title,
	ext,
}: {
	index: number;
	title: string;
	ext: string;
}): string {
	const safe = sanitizeFileName(title) || `video_${index}`;
	return `${String(index).padStart(3, "0")} - ${safe}.${ext}`;
}
