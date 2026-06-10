// Dub-unit packing — the cure for fragmented sub-second slots ("Okay." in a
// 0.39s cue → ×2.24 robotic speed-up and overlap bleed into the next line).
// Consecutive sentences in one speech run are packed into a UNIT: one TTS call
// (natural prosody across sentences), one timeline element, one speed fit over
// the unit's whole span. Overflow can then only spill into REAL silence
// between speech runs (gap > MAX_CHAIN_GAP), never over the next line.
// Subtitles stay per-sentence — packing only changes the AUDIO granularity.

import { DEFAULT_SECONDS_PER_CHAR, estimateDuration } from "@/dub/timing";
import { languageByCode } from "@/dub/languages";
import type { Segment } from "@/dub/types";

export interface DubUnit {
	id: string;
	/** member segment ids, in timeline order */
	segIds: string[];
	/** concatenated member translations (sentences carry their own 标点) */
	text: string;
	/** timeline start = first member's start (seconds) */
	start: number;
	/** available time = first start → last member's extended slot end (s) */
	span: number;
	/** set when the unit is a single manually-rated line */
	manualRate?: number;
}

/** speech runs are chained only across gaps up to this (seconds) */
const MAX_CHAIN_GAP = 0.75;
/** a slot shorter than this can't host natural Chinese — always absorb it */
const MIN_COMFORTABLE_SLOT = 1.2;
/** safety caps: unit length on the timeline / TTS request text size */
const MAX_UNIT_SPAN_SECONDS = 14;
const MAX_UNIT_TEXT_CHARS = 280;

/**
 * The 280-char TTS-request cap was tuned for Chinese (~1 syllable/char).
 * Lower-density scripts say less per char, so the cap scales with the
 * language's speech rate — clamped so zh stays exactly 280 and latin
 * scripts never exceed a safe request size.
 */
function maxUnitChars({ secondsPerChar }: { secondsPerChar: number }): number {
	const scaled = Math.round(
		(MAX_UNIT_TEXT_CHARS * DEFAULT_SECONDS_PER_CHAR) / secondsPerChar,
	);
	return Math.min(700, Math.max(MAX_UNIT_TEXT_CHARS, scaled));
}

interface Building {
	segs: Segment[];
	text: string;
}

function slotEnd(seg: Segment): number {
	return seg.start + seg.timing.targetDuration;
}

function fitsNatively({
	text,
	span,
	nativeMaxSpeed,
	secondsPerChar,
}: {
	text: string;
	span: number;
	nativeMaxSpeed: number;
	secondsPerChar: number;
}): boolean {
	if (span <= 0) return false;
	return estimateDuration({ text, secondsPerChar }) <= span * nativeMaxSpeed;
}

/**
 * Greedy packer over the dubbable (translated, in-order) segments. A unit
 * keeps absorbing the next segment while the speech run is continuous AND
 * (the unit still can't fit natively OR the next segment is itself a fragment
 * that can't host natural speech), within span/text safety caps.
 * Manual-speed lines always form their own unit and break chains.
 */
export function packDubUnits({
	segments,
	settings,
}: {
	segments: Segment[];
	settings: { nativeMaxSpeed: number; targetLang?: string };
}): DubUnit[] {
	const dubbable = segments.filter((s) => s.translated.trim().length > 0);
	const nativeMax = Math.max(1, settings.nativeMaxSpeed);
	const secondsPerChar = languageByCode(
		settings.targetLang ?? "zh",
	).secondsPerChar;
	const textCap = maxUnitChars({ secondsPerChar });
	const units: DubUnit[] = [];
	let cur: Building | null = null;

	const close = () => {
		if (!cur) return;
		const first = cur.segs[0];
		const last = cur.segs[cur.segs.length - 1];
		units.push({
			id: `unit_${String(units.length).padStart(3, "0")}`,
			segIds: cur.segs.map((s) => s.id),
			text: cur.text,
			start: first.start,
			span: Number((slotEnd(last) - first.start).toFixed(3)),
			manualRate:
				cur.segs.length === 1 && first.speedMode === "manual"
					? first.timing.appliedSpeedup
					: undefined,
		});
		cur = null;
	};

	for (const seg of dubbable) {
		const zh = seg.translated.trim();

		// manual lines: standalone unit, and they break any running chain
		if (seg.speedMode === "manual") {
			close();
			cur = { segs: [seg], text: zh };
			close();
			continue;
		}

		if (!cur) {
			cur = { segs: [seg], text: zh };
			continue;
		}

		const lastSeg = cur.segs[cur.segs.length - 1];
		const gap = seg.start - lastSeg.end;
		const curStart = cur.segs[0].start;
		const curSpan = slotEnd(lastSeg) - curStart;
		const mergedSpan = slotEnd(seg) - curStart;
		const mergedText = cur.text + zh;

		const unitNeedsMore = !fitsNatively({
			text: cur.text,
			span: curSpan,
			nativeMaxSpeed: nativeMax,
			secondsPerChar,
		});
		const nextIsFragment =
			seg.timing.targetDuration < MIN_COMFORTABLE_SLOT ||
			!fitsNatively({
				text: zh,
				span: seg.timing.targetDuration,
				nativeMaxSpeed: nativeMax,
				secondsPerChar,
			});

		const shouldChain =
			gap <= MAX_CHAIN_GAP &&
			(unitNeedsMore || nextIsFragment) &&
			mergedSpan <= MAX_UNIT_SPAN_SECONDS &&
			mergedText.length <= textCap;

		if (shouldChain) {
			cur.segs.push(seg);
			cur.text = mergedText;
		} else {
			close();
			cur = { segs: [seg], text: zh };
		}
	}
	close();

	return units;
}
