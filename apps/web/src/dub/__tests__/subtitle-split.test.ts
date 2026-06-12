import { describe, expect, test } from "bun:test";
import {
	captionWidth,
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
	test("single chunk keeps original timing", () => {
		const out = splitCaption({ text: "短句。", start: 3, duration: 2 });
		expect(out).toEqual([{ text: "短句。", start: 3, duration: 2 }]);
	});

	test("durations are proportional, monotonic, and sum exactly", () => {
		const text = `${"前".repeat(20)}，${"后后".repeat(20)}。`;
		const out = splitCaption({ text, start: 10, duration: 9 });
		expect(out.length).toBeGreaterThan(1);
		// starts monotonic, tiles without gaps
		for (let i = 1; i < out.length; i++) {
			expect(out[i].start).toBeCloseTo(
				out[i - 1].start + out[i - 1].duration,
				10,
			);
		}
		const last = out[out.length - 1];
		expect(last.start + last.duration).toBeCloseTo(19, 10);
		// proportional: longer chunk gets more time
		const sorted = [...out].sort((a, b) => width(b.text) - width(a.text));
		expect(sorted[0].duration).toBeGreaterThanOrEqual(
			sorted[sorted.length - 1].duration,
		);
		for (const cue of out) {
			expect(cue.duration).toBeGreaterThan(0);
		}
	});

	test("short slot prefers fewer captions over sub-2s flashes", () => {
		// 35 CJK (width 70) in a 1s slot: soft split would be 2 × 0.5s flashes;
		// width 70 fits under the hard wall (80) → keep ONE caption
		const out = splitCaption({
			text: "字".repeat(35),
			start: 0,
			duration: 1,
		});
		expect(out.length).toBe(1);
	});

	test("hard wall still splits even in a short slot", () => {
		// 50 CJK (width 100) exceeds the hard wall — must split despite 1s slot
		const out = splitCaption({
			text: "字".repeat(50),
			start: 0,
			duration: 1,
		});
		expect(out.length).toBeGreaterThan(1);
		for (const cue of out) {
			expect(width(cue.text)).toBeLessThanOrEqual(80);
		}
	});

	test("long slot keeps the fine-grained split", () => {
		// 100 CJK (width 200) over 18s: time allows ≥4 chunks → soft split wins
		const out = splitCaption({
			text: "字".repeat(100),
			start: 0,
			duration: 18,
		});
		expect(out.length).toBe(4);
		for (const cue of out) {
			expect(cue.duration).toBeGreaterThanOrEqual(2 - 1e-9);
		}
	});

	test("zero duration never produces negative durations", () => {
		const out = splitCaption({
			text: "字".repeat(70),
			start: 5,
			duration: 0,
		});
		expect(out.length).toBeGreaterThan(1);
		for (const cue of out) {
			expect(cue.duration).toBe(0);
			expect(cue.start).toBe(5);
		}
	});
});
