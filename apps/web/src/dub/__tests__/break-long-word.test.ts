import { describe, expect, test } from "bun:test";
import { breakLongWord } from "@/subtitles/break-long-word";

// measure = code-unit length keeps the math human-readable
const byLength = (t: string) => t.length;

describe("breakLongWord", () => {
	test("splits a long CJK run into maxWidth-sized lines", () => {
		const word = "这是一段没有任何空格的超长中文字幕文本一共二十五个字";
		const lines = breakLongWord({ word, maxWidth: 10, measure: byLength });
		expect(lines).toEqual([
			"这是一段没有任何空格",
			"的超长中文字幕文本一",
			"共二十五个字",
		]);
		for (const line of lines) {
			expect(byLength(line)).toBeLessThanOrEqual(10);
		}
	});

	test("returns a fitting word unchanged", () => {
		expect(
			breakLongWord({ word: "短句", maxWidth: 10, measure: byLength }),
		).toEqual(["短句"]);
	});

	test("never splits surrogate pairs / emoji mid-grapheme", () => {
		const word = "😀".repeat(12); // each emoji = 2 code units
		const lines = breakLongWord({ word, maxWidth: 5, measure: byLength });
		expect(lines.join("")).toBe(word);
		for (const line of lines) {
			// whole emoji per line — never an odd count of code units
			expect(line.length % 2).toBe(0);
		}
	});

	test("maxWidth smaller than one grapheme still terminates", () => {
		const lines = breakLongWord({ word: "宽宽宽", maxWidth: 0, measure: byLength });
		expect(lines).toEqual(["宽", "宽", "宽"]);
	});

	test("empty word yields the word itself", () => {
		expect(breakLongWord({ word: "", maxWidth: 10, measure: byLength })).toEqual([
			"",
		]);
	});
});
