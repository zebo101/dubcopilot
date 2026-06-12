// Split one segment's translated text into multiple sequential captions.
// Segments merge up to ~20s of speech for TTS prosody (sanitize.ts) — great
// for audio, terrible as ONE caption: 60-120 chars wrap into a wall of text
// covering half the video. Display-side we re-split into short captions and
// tile them across the segment's time slot.

/** ~5.56%H font (SUBTITLE_FONT_SIZE 5 / FONT_SIZE_SCALE_REFERENCE 90) at 80%
 * width on 16:9 fits ≈25 CJK glyphs per line — 30 chars caps a caption at
 * two lines even on narrower aspect ratios. */
export const DEFAULT_CAPTION_MAX_CHARS = 30;

// lookbehind keeps the punctuation attached to the preceding clause
const CLAUSE_BOUNDARY = /(?<=[。！？；，、…．!?;:,.])/u;
const SPACE_BOUNDARY = /(?<=\s)/u;

function codePointLength({ text }: { text: string }): number {
	return Array.from(text).length;
}

function hardSlice({
	text,
	maxChars,
}: {
	text: string;
	maxChars: number;
}): string[] {
	const points = Array.from(text);
	// balanced slice size — 31 chars become 16+15, not 30+1
	const sliceCount = Math.ceil(points.length / maxChars);
	const sliceLen = Math.ceil(points.length / sliceCount);
	const out: string[] = [];
	for (let i = 0; i < points.length; i += sliceLen) {
		out.push(points.slice(i, i + sliceLen).join(""));
	}
	return out;
}

/** Tokenize into clause-ish pieces, none longer than maxChars. */
function tokenize({
	text,
	maxChars,
}: {
	text: string;
	maxChars: number;
}): string[] {
	const tokens: string[] = [];
	for (const clause of text.split(CLAUSE_BOUNDARY)) {
		if (codePointLength({ text: clause }) <= maxChars) {
			tokens.push(clause);
			continue;
		}
		for (const piece of clause.split(SPACE_BOUNDARY)) {
			if (codePointLength({ text: piece }) <= maxChars) {
				tokens.push(piece);
			} else {
				tokens.push(...hardSlice({ text: piece, maxChars }));
			}
		}
	}
	return tokens;
}

export function splitCaptionText({
	text,
	maxChars = DEFAULT_CAPTION_MAX_CHARS,
}: {
	text: string;
	maxChars?: number;
}): string[] {
	const trimmed = text.trim();
	if (!trimmed) return [trimmed];
	const totalLen = codePointLength({ text: trimmed });
	if (totalLen <= maxChars) return [trimmed];

	// balance chunks so 31 chars becomes 16+15, not 30+1
	const targetChunks = Math.ceil(totalLen / maxChars);
	const targetLen = Math.ceil(totalLen / targetChunks);

	const chunks: string[] = [];
	let current = "";
	let currentLen = 0;
	for (const token of tokenize({ text: trimmed, maxChars })) {
		const joined = current + token;
		const joinedLen = codePointLength({ text: joined.trim() });
		if (current && (joinedLen > maxChars || currentLen >= targetLen)) {
			chunks.push(current.trim());
			current = token;
		} else {
			current = joined;
		}
		currentLen = codePointLength({ text: current.trim() });
	}
	if (current.trim()) chunks.push(current.trim());
	return chunks.filter((c) => c.length > 0);
}

export function splitCaption({
	text,
	start,
	duration,
	maxChars = DEFAULT_CAPTION_MAX_CHARS,
}: {
	text: string;
	start: number;
	duration: number;
	maxChars?: number;
}): { text: string; start: number; duration: number }[] {
	const chunks = splitCaptionText({ text, maxChars });
	if (chunks.length <= 1) {
		return [{ text: chunks[0] ?? text.trim(), start, duration }];
	}
	if (duration <= 0) {
		return chunks.map((c) => ({ text: c, start, duration: 0 }));
	}
	const lens = chunks.map((c) => codePointLength({ text: c }));
	const total = lens.reduce((a, b) => a + b, 0);
	const out: { text: string; start: number; duration: number }[] = [];
	let cursor = start;
	for (let i = 0; i < chunks.length; i++) {
		const isLast = i === chunks.length - 1;
		// last chunk absorbs float drift so the series ends exactly on time
		const d = isLast
			? start + duration - cursor
			: (duration * lens[i]) / total;
		out.push({ text: chunks[i], start: cursor, duration: d });
		cursor += d;
	}
	return out;
}
