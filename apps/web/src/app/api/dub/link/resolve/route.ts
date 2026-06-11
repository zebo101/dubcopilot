import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classifyLink, oneDriveContentUrl } from "@/dub/course/link/parse";
import type { LinkItem, ResolveResponse } from "@/dub/course/link/types";
import {
	ensureYtDlp,
	hasFfmpeg,
	resolveProxy,
	run,
} from "@/dub/course/link/server/bin";
import { isPrivateHost } from "@/dub/course/link/server/jobs";

// Resolve pasted URLs into downloadable items: expand YouTube playlists,
// fetch titles/sizes. Local tool — yt-dlp runs on this machine.

export const runtime = "nodejs";

const bodySchema = z.object({
	urls: z.array(z.string().min(1)).min(1).max(300),
	proxy: z.string().optional(),
});

function makeKey(): string {
	return crypto.randomUUID().slice(0, 13).replace(/-/g, "");
}

function errorItem({ url, message }: { url: string; message: string }): LinkItem {
	return {
		key: makeKey(),
		kind: "direct",
		url,
		title: url.slice(0, 80),
		sizeBytes: null,
		durationSec: null,
		subtitles: [],
		error: message,
	};
}

async function ytDlpJson({
	url,
	proxy,
	flat,
}: {
	url: string;
	proxy?: string;
	flat: boolean;
}): Promise<Record<string, unknown>> {
	const bin = await ensureYtDlp({ proxy });
	const args = [
		"-J",
		"--no-warnings",
		"--socket-timeout",
		"20",
		flat ? "--flat-playlist" : "--no-playlist",
		...(proxy ? ["--proxy", proxy] : []),
		"--",
		url,
	];
	const r = await run({ cmd: bin, args });
	if (r.code !== 0) {
		throw new Error(
			r.stderr.split(/\r?\n/).filter(Boolean).slice(-2).join(" ") ||
				`yt-dlp 退出码 ${r.code}`,
		);
	}
	return JSON.parse(r.stdout) as Record<string, unknown>;
}

async function resolveYouTube({
	url,
	proxy,
}: {
	url: string;
	proxy?: string;
}): Promise<LinkItem[]> {
	const info = await ytDlpJson({ url, proxy, flat: false });
	return [
		{
			key: makeKey(),
			kind: "youtube",
			url,
			title: typeof info.title === "string" ? info.title : url,
			sizeBytes:
				typeof info.filesize_approx === "number" ? info.filesize_approx : null,
			durationSec: typeof info.duration === "number" ? info.duration : null,
			subtitles:
				info.subtitles && typeof info.subtitles === "object"
					? Object.keys(info.subtitles as Record<string, unknown>)
					: [],
			error: null,
		},
	];
}

async function resolvePlaylist({
	url,
	proxy,
}: {
	url: string;
	proxy?: string;
}): Promise<LinkItem[]> {
	const info = await ytDlpJson({ url, proxy, flat: true });
	const entries = Array.isArray(info.entries) ? info.entries : [];
	return entries
		.filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
		.map((e) => ({
			key: makeKey(),
			kind: "youtube" as const,
			url:
				typeof e.url === "string" && e.url.startsWith("http")
					? e.url
					: `https://www.youtube.com/watch?v=${String(e.id ?? "")}`,
			title: typeof e.title === "string" ? e.title : String(e.id ?? "视频"),
			sizeBytes: null,
			durationSec: typeof e.duration === "number" ? e.duration : null,
			subtitles: [],
			error: null,
		}));
}

async function resolveGDrive({
	url,
	proxy,
}: {
	url: string;
	proxy?: string;
}): Promise<LinkItem[]> {
	const info = await ytDlpJson({ url, proxy, flat: false });
	return [
		{
			key: makeKey(),
			kind: "gdrive",
			url,
			title: typeof info.title === "string" ? info.title : "Google Drive 文件",
			sizeBytes: typeof info.filesize === "number" ? info.filesize : null,
			durationSec: typeof info.duration === "number" ? info.duration : null,
			subtitles: [],
			error: null,
		},
	];
}

/** Range-probe OneDrive/direct links for name + size; failures are soft
 * (the download step retries with the yt-dlp generic extractor). */
async function probeUrl({
	item,
	probeUrl: target,
}: {
	item: LinkItem;
	probeUrl: string;
}): Promise<LinkItem> {
	try {
		const parsed = new URL(target);
		if (isPrivateHost(parsed.hostname)) {
			return { ...item, error: "不支持内网/本机地址" };
		}
		const res = await fetch(target, {
			headers: { Range: "bytes=0-0" },
			redirect: "follow",
			signal: AbortSignal.timeout(15000),
		});
		await res.body?.cancel().catch(() => {});
		const type = res.headers.get("content-type") ?? "";
		if (!res.ok && res.status !== 206) {
			return {
				...item,
				error:
					item.kind === "onedrive"
						? `OneDrive 响应 ${res.status}——请确认分享权限为「任何人可查看」`
						: `链接响应 ${res.status}`,
			};
		}
		if (type.startsWith("text/html")) {
			return {
				...item,
				error:
					item.kind === "onedrive"
						? "分享链接返回了网页——请确认权限为「任何人可查看」"
						: "该链接是网页而非视频直链",
			};
		}
		const range = res.headers.get("content-range");
		const total = range?.match(/\/(\d+)$/)?.[1];
		const size = total
			? Number(total)
			: Number(res.headers.get("content-length")) || null;
		const cd = res.headers.get("content-disposition") ?? "";
		const fname =
			cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1] ??
			cd.match(/filename="?([^";]+)"?/i)?.[1];
		let title = item.title;
		if (fname) {
			try {
				title = decodeURIComponent(fname.trim().replace(/^"|"$/g, ""));
			} catch {
				title = fname.trim();
			}
		}
		return { ...item, title, sizeBytes: size && size > 1 ? size : null };
	} catch {
		return item; // soft failure — download will surface real errors
	}
}

function baseItemFor({
	kind,
	url,
}: {
	kind: LinkItem["kind"];
	url: string;
}): LinkItem {
	let title = url;
	try {
		const last = new URL(url).pathname.split("/").filter(Boolean).pop();
		if (kind === "direct" && last?.includes(".")) {
			title = decodeURIComponent(last);
		} else if (kind === "onedrive") {
			title = "OneDrive 文件";
		}
	} catch {
		/* keep url as title */
	}
	return {
		key: makeKey(),
		kind,
		url,
		title,
		sizeBytes: null,
		durationSec: null,
		subtitles: [],
		error: null,
	};
}

export async function POST(request: NextRequest) {
	const parsed = bodySchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid input" }, { status: 400 });
	}
	const proxy = resolveProxy(parsed.data.proxy);
	const urls = [...new Set(parsed.data.urls.map((u) => u.trim()).filter(Boolean))];

	const items: LinkItem[] = [];
	for (const url of urls) {
		const link = classifyLink(url);
		try {
			if (!link) {
				items.push(errorItem({ url, message: "无法识别的链接" }));
			} else if (link.kind === "gdrive-folder") {
				items.push(
					errorItem({
						url,
						message:
							"Drive 文件夹分享暂不支持——请逐个文件分享，或下载到本地后用「本地文件夹」导入",
					}),
				);
			} else if (link.kind === "youtube-playlist") {
				items.push(...(await resolvePlaylist({ url, proxy })));
			} else if (link.kind === "youtube") {
				items.push(...(await resolveYouTube({ url, proxy })));
			} else if (link.kind === "gdrive") {
				items.push(...(await resolveGDrive({ url, proxy })));
			} else {
				const base = baseItemFor({ kind: link.kind, url });
				const target =
					link.kind === "onedrive" ? oneDriveContentUrl(url) : url;
				items.push(await probeUrl({ item: base, probeUrl: target }));
			}
		} catch (error) {
			console.error(`[dub/link] resolve failed for ${url}:`, error);
			items.push(
				errorItem({
					url,
					message: error instanceof Error ? error.message : String(error),
				}),
			);
		}
	}

	const response: ResolveResponse = {
		items,
		ffmpegMissing: !(await hasFfmpeg()),
	};
	return NextResponse.json(response);
}
