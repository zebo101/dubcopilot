// Parse SRT / WebVTT subtitle files into timed cues. Course videos that ship a
// sibling *_en.srt / .vtt let the batch pipeline skip ASR entirely — this is
// what makes hundreds of hours feasible locally. Pure + dependency-free.

export interface SubtitleCue {
	start: number; // seconds
	end: number; // seconds
	text: string;
}

/** "HH:MM:SS,mmm" | "HH:MM:SS.mmm" | "MM:SS.mmm" → seconds (null if unparsable). */
function parseTimestamp(raw: string): number | null {
	const norm = raw.trim().replace(",", ".");
	const parts = norm.split(":");
	if (parts.length < 2 || parts.length > 3) return null;
	let h = 0;
	let m = 0;
	let s = 0;
	if (parts.length === 3) {
		h = Number(parts[0]);
		m = Number(parts[1]);
		s = Number(parts[2]);
	} else {
		m = Number(parts[0]);
		s = Number(parts[1]);
	}
	if ([h, m, s].some((n) => Number.isNaN(n))) return null;
	return h * 3600 + m * 60 + s;
}

/** Strip SRT/VTT inline markup and styling so only spoken text remains. */
function cleanCueText(lines: string[]): string {
	return lines
		.join(" ")
		.replace(/<[^>]+>/g, "") // <i>, <c>, <00:00:01.000> etc.
		.replace(/\{[^}]*\}/g, "") // {\an8} ASS-style overrides
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Parse SRT or WebVTT content into cues. Auto-detects the format, tolerates
 * BOM, CRLF, cue numbers, NOTE/STYLE blocks, and VTT cue settings after the end
 * time. Returns cues in source order; malformed blocks are skipped.
 */
export function parseSubtitles({ content }: { content: string }): SubtitleCue[] {
	const text = content
		.replace(/^﻿/, "")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n");

	const blocks = text.split(/\n{2,}/);
	const cues: SubtitleCue[] = [];

	for (const block of blocks) {
		const lines = block.split("\n").filter((l) => l.trim().length > 0);
		if (lines.length === 0) continue;

		const tsIdx = lines.findIndex((l) => l.includes("-->"));
		if (tsIdx === -1) continue; // WEBVTT header, NOTE/STYLE blocks, etc.

		const [startPart, endPart] = lines[tsIdx].split("-->");
		if (!startPart || !endPart) continue;
		// VTT may append cue settings after the end time: "... 00:00:04.000 line:90%"
		const start = parseTimestamp(startPart);
		const end = parseTimestamp(endPart.trim().split(/\s+/)[0] ?? "");
		if (start === null || end === null || end < start) continue;

		const cueText = cleanCueText(lines.slice(tsIdx + 1));
		if (cueText) cues.push({ start, end, text: cueText });
	}

	return cues;
}

/** Recognized subtitle file extensions, lowercase, without the dot. */
export const SUBTITLE_EXTENSIONS = ["srt", "vtt"] as const;
