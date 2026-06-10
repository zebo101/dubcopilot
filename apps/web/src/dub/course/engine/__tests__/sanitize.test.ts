import { describe, expect, test } from "bun:test";
import { sanitizeSegments } from "@/dub/sanitize";

interface Raw {
	start: number;
	end: number;
	text: string;
}

const r = (start: number, end: number, text: string): Raw => ({ start, end, text });

describe("sanitizeSegments", () => {
	test("drops a degenerate repetition-loop segment (Whisper hallucination)", () => {
		const out = sanitizeSegments({
			raw: [
				r(0, 3, "Now let's open the editor."),
				r(3, 20, "and the screen and the screen and the screen and the screen and the screen"),
				r(20, 23, "Click the run button."),
			],
		});
		expect(out.map((s) => s.text)).toEqual([
			"Now let's open the editor.",
			"Click the run button.",
		]);
	});

	test("collapses consecutive duplicate segments, keeping the first", () => {
		const out = sanitizeSegments({
			raw: [
				r(0, 2, "and the screen"),
				r(2, 4, "and the screen"),
				r(4, 6, "And the screen."),
				r(6, 9, "Now we continue with the lesson."),
			],
		});
		expect(out).toHaveLength(2);
		expect(out[0].start).toBe(0);
		expect(out[1].text).toBe("Now we continue with the lesson.");
	});

	test("merges comma-level fragments into one sentence", () => {
		const out = sanitizeSegments({
			raw: [
				r(0, 1.5, "So if you're doing this,"),
				r(1.6, 3.0, "then you need to install Node,"),
				r(3.1, 4.5, "and restart the terminal."),
				r(6.0, 8.0, "Next chapter."),
			],
		});
		expect(out).toHaveLength(2);
		expect(out[0].text).toBe(
			"So if you're doing this, then you need to install Node, and restart the terminal.",
		);
		expect(out[0].start).toBe(0);
		expect(out[0].end).toBe(4.5);
	});

	test("does NOT merge across sentence-final punctuation or big gaps", () => {
		const out = sanitizeSegments({
			raw: [
				r(0, 2, "This is done."),
				r(2.1, 4, "Now the next thing,"),
				r(6.5, 8, "after a long pause."),
			],
		});
		expect(out).toHaveLength(3);
	});

	test("real course SRT shape: long continuation cues DO merge (2-cue sentence > 8s)", () => {
		// Udemy-style: cue ends mid-sentence, next starts at the same timestamp
		const out = sanitizeSegments({
			raw: [
				r(16.41, 21.57, "runtime environment that runs on the"),
				r(21.57, 25.32, "V8 engine and executes JavaScript code outside of a web browser."),
			],
		});
		expect(out).toHaveLength(1);
		expect(out[0].end).toBe(25.32);
	});

	test("merge safety net: run-on chains stop at the 20s cap", () => {
		const out = sanitizeSegments({
			raw: [r(0, 12, "first very long part,"), r(12.1, 25, "second very long part,")],
		});
		expect(out).toHaveLength(2); // 25s combined > 20s cap → forced break
	});

	test("drops empty / punctuation-only segments", () => {
		const out = sanitizeSegments({
			raw: [r(0, 1, "..."), r(1, 2, "  "), r(2, 4, "Real content here.")],
		});
		expect(out).toHaveLength(1);
	});
});
