// Split one segment's translated text into multiple sequential captions.
// Segments merge up to ~20s of speech for TTS prosody (sanitize.ts) — great
// for audio, terrible as ONE caption: 60-120 chars wrap into a wall of text
// covering half the video. Display-side we re-split into short captions and
// tile them across the segment's time slot.
//
// Length is counted in DISPLAY WIDTH units (CJK/full-width = 2, everything
// else = 1), borrowed from VideoLingo's calc_len — an English letter takes
// roughly half the screen width of a hanzi, so a flat char count split
// English far too aggressively.

/** ~5.56%H font (SUBTITLE_FONT_SIZE 5 / FONT_SIZE_SCALE_REFERENCE 90) at 80%
 * width on 16:9 fits ≈25 CJK glyphs per line — 60 width units (30 CJK or
 * 60 latin chars) caps a caption at two lines even on narrower ratios. */
export const DEFAULT_CAPTION_MAX_WIDTH = 60;

/** Absolute wall (40 CJK ≈ two full lines) — only reached when the time
 * slot is too short to show more chunks (see MIN_CAPTION_SECONDS). */
const CAPTION_HARD_MAX_WIDTH = 80;

/** A caption flashing for under ~2s is unreadable (VideoLingo forcibly
 * extends to 2.5s; we can't extend — the slot is fixed — so we split into
 * FEWER, slightly longer captions instead). */
const MIN_CAPTION_SECONDS = 2;

/** How long a caption may linger after the speech ends (VideoLingo removes
 * gaps under 1s; larger gaps end the subtitle with the speech). */
export const CAPTION_LINGER_SECONDS = 1;

/** Display window for a segment's captions. `slot` is the extended slot
 * (until the next line); `speech` is how long someone is actually talking
 * (dub audio after speed-fit, or the original cue span). Small gaps are
 * filled for continuous reading; a long silence no longer keeps the
 * caption on screen — it ends ≤1s after the speech does. */
export function captionWindow({
	slot,
	speech,
}: {
	slot: number;
	speech: number;
}): number {
	if (speech <= 0 || speech >= slot) return slot;
	return Math.min(slot, speech + CAPTION_LINGER_SECONDS);
}

// lookbehind keeps the punctuation attached to the preceding clause
const CLAUSE_BOUNDARY = /(?<=[。！？；，、…．!?;:,.])/u;
const SPACE_BOUNDARY = /(?<=\s)/u;

// CJK ideographs, kana, hangul, CJK punctuation, full-width forms
const WIDE_CHAR =
	/[ᄀ-ᇿ⺀-〿぀-ヿ㄰-㆏㇀-鿿ꥠ-꥿가-퟿豈-﫿︰-﹏＀-｠￠-￦]/u;

/** Display width: wide (CJK/full-width) chars count 2, the rest 1. */
export function captionWidth({ text }: { text: string }): number {
	let width = 0;
	for (const ch of text) {
		width += WIDE_CHAR.test(ch) ? 2 : 1;
	}
	return width;
}

function hardSlice({
	text,
	maxWidth,
}: {
	text: string;
	maxWidth: number;
}): string[] {
	const points = Array.from(text);
	const total = captionWidth({ text });
	// balanced slices — 31 CJK become 16+15, not 30+1. The target is
	// recomputed from what's LEFT each slice, so all-wide text (which can
	// only hit even widths) still lands near the ideal odd boundary.
	const sliceCount = Math.max(1, Math.ceil(total / maxWidth));
	const out: string[] = [];
	let current = "";
	let currentWidth = 0;
	let remainingWidth = total;
	for (const ch of points) {
		const w = WIDE_CHAR.test(ch) ? 2 : 1;
		current += ch;
		currentWidth += w;
		remainingWidth -= w;
		const slicesLeft = sliceCount - out.length;
		const target = Math.ceil((currentWidth + remainingWidth) / slicesLeft);
		if (slicesLeft > 1 && currentWidth >= target) {
			out.push(current);
			current = "";
			currentWidth = 0;
		}
	}
	if (current) out.push(current);
	return out;
}

/** Tokenize into clause-ish pieces, none wider than maxWidth. */
function tokenize({
	text,
	maxWidth,
}: {
	text: string;
	maxWidth: number;
}): string[] {
	const tokens: string[] = [];
	for (const clause of text.split(CLAUSE_BOUNDARY)) {
		if (captionWidth({ text: clause }) <= maxWidth) {
			tokens.push(clause);
			continue;
		}
		for (const piece of clause.split(SPACE_BOUNDARY)) {
			if (captionWidth({ text: piece }) <= maxWidth) {
				tokens.push(piece);
			} else {
				tokens.push(...hardSlice({ text: piece, maxWidth }));
			}
		}
	}
	return tokens;
}

export function splitCaptionText({
	text,
	maxWidth = DEFAULT_CAPTION_MAX_WIDTH,
}: {
	text: string;
	maxWidth?: number;
}): string[] {
	const trimmed = text.trim();
	if (!trimmed) return [trimmed];
	const totalWidth = captionWidth({ text: trimmed });
	if (totalWidth <= maxWidth) return [trimmed];

	// balance chunks so 31 CJK become 16+15, not 30+1
	const targetChunks = Math.ceil(totalWidth / maxWidth);
	const targetWidth = Math.ceil(totalWidth / targetChunks);

	const chunks: string[] = [];
	let current = "";
	let currentWidth = 0;
	for (const token of tokenize({ text: trimmed, maxWidth })) {
		const joined = current + token;
		const joinedWidth = captionWidth({ text: joined.trim() });
		if (current && (joinedWidth > maxWidth || currentWidth >= targetWidth)) {
			chunks.push(current.trim());
			current = token;
		} else {
			current = joined;
		}
		currentWidth = captionWidth({ text: current.trim() });
	}
	if (current.trim()) chunks.push(current.trim());
	return chunks.filter((c) => c.length > 0);
}

export function splitCaption({
	text,
	start,
	duration,
	maxWidth = DEFAULT_CAPTION_MAX_WIDTH,
}: {
	text: string;
	start: number;
	duration: number;
	maxWidth?: number;
}): { text: string; start: number; duration: number }[] {
	const trimmed = text.trim();
	const totalWidth = captionWidth({ text: trimmed });

	// duration-aware chunk count: a short slot prefers FEWER, longer captions
	// (each still under the hard wall) over sub-2s flashes
	let effectiveMax = maxWidth;
	if (duration > 0 && totalWidth > maxWidth) {
		const softChunks = Math.ceil(totalWidth / maxWidth);
		const byTime = Math.max(1, Math.floor(duration / MIN_CAPTION_SECONDS));
		const hardChunks = Math.ceil(totalWidth / CAPTION_HARD_MAX_WIDTH);
		const chunkCount = Math.max(hardChunks, Math.min(softChunks, byTime));
		if (chunkCount < softChunks) {
			effectiveMax = Math.min(
				CAPTION_HARD_MAX_WIDTH,
				Math.ceil(totalWidth / chunkCount),
			);
		}
	}

	const chunks = splitCaptionText({ text: trimmed, maxWidth: effectiveMax });
	if (chunks.length <= 1) {
		return [{ text: chunks[0] ?? trimmed, start, duration }];
	}
	if (duration <= 0) {
		return chunks.map((c) => ({ text: c, start, duration: 0 }));
	}
	const widths = chunks.map((c) => captionWidth({ text: c }));
	const total = widths.reduce((a, b) => a + b, 0);
	const out: { text: string; start: number; duration: number }[] = [];
	let cursor = start;
	for (let i = 0; i < chunks.length; i++) {
		const isLast = i === chunks.length - 1;
		// last chunk absorbs float drift so the series ends exactly on time
		const d = isLast
			? start + duration - cursor
			: (duration * widths[i]) / total;
		out.push({ text: chunks[i], start: cursor, duration: d });
		cursor += d;
	}
	return out;
}
