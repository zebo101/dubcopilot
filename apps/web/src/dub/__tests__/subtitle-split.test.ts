import { describe, expect, test } from "bun:test";
import { splitCaption, splitCaptionText } from "@/dub/subtitle-split";

const len = (t: string) => Array.from(t).length;

describe("splitCaptionText", () => {
	test("short text passes through untouched", () => {
		const text = "这是一句不长的中文字幕。";
		expect(splitCaptionText({ text, maxChars: 30 })).toEqual([text]);
	});

	test("splits at CJK punctuation, punctuation stays at chunk end", () => {
		const text =
			"如果你没用过乌班图服务器，首先会注意到它没有图形界面。像视窗系统这类操作系统有图形界面，而服务器只有命令行。";
		const chunks = splitCaptionText({ text, maxChars: 30 });
		expect(chunks.length).toBeGreaterThan(1);
		for (const c of chunks) {
			expect(len(c)).toBeLessThanOrEqual(30);
		}
		// no characters lost
		expect(chunks.join("")).toBe(text);
		// at least one chunk ends with sentence punctuation (boundary split)
		expect(chunks.some((c) => /[。，]$/.test(c))).toBe(true);
	});

	test("31 unpunctuated chars split into balanced halves, not 30+1", () => {
		const text = "字".repeat(31);
		const chunks = splitCaptionText({ text, maxChars: 30 });
		expect(chunks.length).toBe(2);
		expect(len(chunks[0])).toBe(16);
		expect(len(chunks[1])).toBe(15);
	});

	test("latin sentence splits at spaces", () => {
		const text =
			"this is a fairly long english sentence that should split at word gaps";
		const chunks = splitCaptionText({ text, maxChars: 30 });
		for (const c of chunks) {
			expect(len(c)).toBeLessThanOrEqual(30);
			expect(c).not.toMatch(/^\s|\s$/);
		}
		expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
	});

	test("pathological run with no punctuation or spaces hard-slices", () => {
		const text = "甲".repeat(100);
		const chunks = splitCaptionText({ text, maxChars: 30 });
		expect(chunks.join("")).toBe(text);
		for (const c of chunks) {
			expect(len(c)).toBeLessThanOrEqual(30);
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
		const sorted = [...out].sort((a, b) => len(b.text) - len(a.text));
		expect(sorted[0].duration).toBeGreaterThanOrEqual(
			sorted[sorted.length - 1].duration,
		);
		for (const cue of out) {
			expect(cue.duration).toBeGreaterThan(0);
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
