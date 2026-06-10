// Transcript sanitation — runs BEFORE translation, on raw transcript segments.
// Whisper (especially Tiny) hallucinates in silence/music: repetition loops
// ("and the screen and the screen…") and consecutive duplicate cues. It also
// fragments speech at comma level, producing tiny slots that then need heavy
// speed-up. Three passes fix all of that (spec: dub-quality-and-session v2 §1).

import type { RawSegment } from "@/dub/transcribe-core";

/** lowercase, strip punctuation/whitespace — for duplicate comparison. */
function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(/[\s\p{P}\p{S}]+/gu, " ")
		.trim();
}

/** Repetition-loop hallucination: few unique tokens repeated many times. */
function isDegenerate(text: string): boolean {
	const tokens = normalize(text).split(" ").filter(Boolean);
	if (tokens.length < 6) return false;
	const unique = new Set(tokens).size;
	return unique / tokens.length < 0.4;
}

const SENTENCE_END = /[.!?。！？…]["')\]]?\s*$/;
const MERGE_MAX_GAP_SECONDS = 0.35;
const MERGE_MAX_DURATION_SECONDS = 8;

/**
 * Clean raw transcript segments:
 * 1. drop empty / degenerate (hallucinated) segments;
 * 2. collapse consecutive duplicates (keep the first);
 * 3. merge comma-level fragments into natural sentences (tight gap, no
 *    sentence-final punctuation, capped total duration).
 * Pure — used by both the in-editor flow and the headless course engine.
 */
export function sanitizeSegments({ raw }: { raw: RawSegment[] }): RawSegment[] {
	// pass 1+2: drop garbage, collapse consecutive duplicates
	const cleaned: RawSegment[] = [];
	let prevNorm: string | null = null;
	for (const seg of raw) {
		const text = seg.text.trim();
		const norm = normalize(text);
		if (!norm) continue; // empty or punctuation-only
		if (isDegenerate(text)) continue; // hallucination loop
		if (prevNorm !== null && norm === prevNorm) continue; // consecutive dupe
		cleaned.push({ ...seg, text });
		prevNorm = norm;
	}

	// pass 3: merge fragments into sentences
	const merged: RawSegment[] = [];
	for (const seg of cleaned) {
		const prev = merged[merged.length - 1];
		const canMerge =
			prev !== undefined &&
			seg.start - prev.end < MERGE_MAX_GAP_SECONDS &&
			!SENTENCE_END.test(prev.text) &&
			seg.end - prev.start <= MERGE_MAX_DURATION_SECONDS;
		if (canMerge) {
			prev.text = `${prev.text} ${seg.text}`;
			prev.end = seg.end;
		} else {
			merged.push({ ...seg });
		}
	}
	return merged;
}
