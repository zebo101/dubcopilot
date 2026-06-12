import { describe, expect, test } from "bun:test";
import {
	captionWidth,
	captionWindow,
	splitCaption,
	splitCaptionText,
} from "@/dub/subtitle-split";

const width = (t: string) => captionWidth({ text: t });

describe("captionWidth", () => {
	test("CJK counts 2, latin counts 1 (VideoLingo-style weighting)", () => {
		expect(width("汉字")).toBe(4);
		expect(width("abcd")).toBe(4);
		expect(width("汉a字b")).toBe(6);
		expect(width("，")).toBe(2); // full-width punctuation is wide
		expect(width(",")).toBe(1);
	});
});

describe("captionWindow", () => {
	test("small gap to the next line is filled (continuous reading)", () => {
		// speech 4s in a 4.8s slot — gap 0.8s ≤ 1s → keep the full slot
		expect(captionWindow({ slot: 4.8, speech: 4 })).toBe(4.8);
	});

	test("long silence ends the caption ~1s after the speech", () => {
		// speech 3s in a 9s slot — caption must NOT linger 6s into silence
		expect(captionWindow({ slot: 9, speech: 3 })).toBe(4);
	});

	test("no speech info falls back to the full slot", () => {
		expect(captionWindow({ slot: 5, speech: 0 })).toBe(5);
	});

	test("speech longer than the slot keeps the slot", () => {
		expect(captionWindow({ slot: 4, speech: 5 })).toBe(4);
	});
});

describe("splitCaptionText", () => {
	test("short CJK text passes through untouched", () => {
		const text = "这是一句不长的中文字幕。";
		expect(splitCaptionText({ text })).toEqual([text]);
	});

	test("60 latin chars stay a single caption (flat count over-split this)", () => {
		const text = "a".repeat(60);
		expect(splitCaptionText({ text })).toEqual([text]);
	});

	test("splits at CJK punctuation, punctuation stays at chunk end", () => {
		const text =
			"如果你没用过乌班图服务器，首先会注意到它没有图形界面。像视窗系统这类操作系统有图形界面，而服务器只有命令行。";
		const chunks = splitCaptionText({ text });
		expect(chunks.length).toBeGreaterThan(1);
		for (const c of chunks) {
			expect(width(c)).toBeLessThanOrEqual(60);
		}
		// no characters lost
		expect(chunks.join("")).toBe(text);
		// at least one chunk ends with sentence punctuation (boundary split)
		expect(chunks.some((c) => /[。，]$/.test(c))).toBe(true);
	});

	test("31 unpunctuated CJK split into balanced halves, not 30+1", () => {
		const text = "字".repeat(31);
		const chunks = splitCaptionText({ text });
		expect(chunks.length).toBe(2);
		expect(Array.from(chunks[0]).length).toBe(16);
		expect(Array.from(chunks[1]).length).toBe(15);
	});

	test("long latin sentence splits at spaces", () => {
		const word = "lengthy";
		const text = Array.from({ length: 12 }, () => word).join(" "); // 95 chars
		const chunks = splitCaptionText({ text });
		expect(chunks.length).toBeGreaterThan(1);
		for (const c of chunks) {
			expect(width(c)).toBeLessThanOrEqual(60);
			expect(c).not.toMatch(/^\s|\s$/);
		}
		expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
	});

	test("pathological run with no punctuation or spaces hard-slices", () => {
		const text = "甲".repeat(100);
		const chunks = splitCaptionText({ text });
		expect(chunks.join("")).toBe(text);
		for (const c of chunks) {
			expect(width(c)).toBeLessThanOrEqual(60);
		}
	});
});

describe("splitCaption", () => {
	test("single chunk keeps the full window", () => {
		const out = splitCaption({ text: "短句。", start: 3, slot: 2, speech: 2 });
		expect(out).toEqual([{ text: "短句。", start: 3, duration: 2 }]);
	});

	test("chunks tile the SPEECH span, not the whole slot", () => {
		// 9s of talk inside an 18s slot — boundaries must all land within the
		// talk span; previously they spread over the slot, drifting captions
		// deep into the trailing silence
		const text = `${"前".repeat(20)}，${"后后".repeat(20)}。`;
		const out = splitCaption({ text, start: 10, speech: 9, slot: 18 });
		expect(out.length).toBeGreaterThan(1);
		// starts monotonic, tiles without gaps
		for (let i = 1; i < out.length; i++) {
			expect(out[i].start).toBeCloseTo(
				out[i - 1].start + out[i - 1].duration,
				10,
			);
			// every boundary inside the talk span
			expect(out[i].start).toBeLessThanOrEqual(10 + 9 + 1e-9);
		}
		// final chunk ends ≤1s after speech (linger), NOT at slot end (28)
		const last = out[out.length - 1];
		expect(last.start + last.duration).toBeCloseTo(20, 10);
		for (const cue of out) {
			expect(cue.duration).toBeGreaterThan(0);
		}
	});

	test("small gap to the next line keeps the full slot", () => {
		const text = `${"前".repeat(20)}，${"后后".repeat(20)}。`;
		// gap 0.8s ≤ 1s → window = slot; chunks tile speech, last fills gap
		const out = splitCaption({ text, start: 0, speech: 9, slot: 9.8 });
		const last = out[out.length - 1];
		expect(last.start + last.duration).toBeCloseTo(9.8, 10);
	});

	test("short talk span prefers fewer captions over sub-2s flashes", () => {
		// 35 CJK (width 70) talked in 1s: soft split would be 2 × 0.5s flashes;
		// width 70 fits under the hard wall (80) → keep ONE caption
		const out = splitCaption({
			text: "字".repeat(35),
			start: 0,
			slot: 1,
			speech: 1,
		});
		expect(out.length).toBe(1);
	});

	test("hard wall still splits even in a short talk span", () => {
		// 50 CJK (width 100) exceeds the hard wall — must split despite 1s talk
		const out = splitCaption({
			text: "字".repeat(50),
			start: 0,
			slot: 1,
			speech: 1,
		});
		expect(out.length).toBeGreaterThan(1);
		for (const cue of out) {
			expect(width(cue.text)).toBeLessThanOrEqual(80);
		}
	});

	test("long talk span keeps the fine-grained split", () => {
		// 100 CJK (width 200) talked over 18s: time allows ≥4 chunks
		const out = splitCaption({
			text: "字".repeat(100),
			start: 0,
			slot: 18,
			speech: 18,
		});
		expect(out.length).toBe(4);
		for (const cue of out) {
			expect(cue.duration).toBeGreaterThanOrEqual(2 - 1e-9);
		}
	});

	test("zero slot never produces negative durations", () => {
		const out = splitCaption({
			text: "字".repeat(70),
			start: 5,
			slot: 0,
		});
		expect(out.length).toBeGreaterThan(1);
		for (const cue of out) {
			expect(cue.duration).toBe(0);
			expect(cue.start).toBe(5);
		}
	});
});
