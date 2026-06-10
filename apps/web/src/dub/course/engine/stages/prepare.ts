// Stage: prepare — zero-copy. Read the lesson's video File straight from its
// FileSystemFileHandle (never persisted to browser storage), probe metadata
// via mediabunny, and parse the sidecar subtitle if one was paired.

import { readVideoFile } from "@/media/mediabunny";
import { parseSubtitles } from "@/dub/course/subtitles";
import type { SubtitleLang } from "@/dub/course/scan";
import type { LessonMeta } from "@/dub/course/engine/types";

export async function prepareLesson({
	videoHandle,
	subtitleHandle,
	subtitleLang,
}: {
	videoHandle: FileSystemFileHandle;
	subtitleHandle: FileSystemFileHandle | null;
	subtitleLang: SubtitleLang | null;
}): Promise<{
	videoFile: File;
	meta: LessonMeta;
	subtitle: { lang: SubtitleLang; cues: ReturnType<typeof parseSubtitles> } | null;
}> {
	const videoFile = await videoHandle.getFile();

	const data = await readVideoFile({ file: videoFile });
	// revoke the probe thumbnail immediately — the engine never shows it
	if (data.thumbnailUrl) URL.revokeObjectURL(data.thumbnailUrl);
	const meta: LessonMeta = {
		duration: data.duration,
		width: data.width,
		height: data.height,
		fps: data.fps,
		hasAudio: data.hasAudio,
	};

	let subtitle: { lang: SubtitleLang; cues: ReturnType<typeof parseSubtitles> } | null =
		null;
	if (subtitleHandle && subtitleLang) {
		const text = await (await subtitleHandle.getFile()).text();
		const cues = parseSubtitles({ content: text });
		if (cues.length > 0) subtitle = { lang: subtitleLang, cues };
	}

	return { videoFile, meta, subtitle };
}
