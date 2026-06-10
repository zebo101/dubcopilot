import { describe, expect, test } from "bun:test";
import { autoFitSpeed, extendSlots, MIN_NATURAL_RATE } from "@/dub/timing";
import type { Segment } from "@/dub/types";

function seg(i: number, start: number, end: number): Segment {
	const target = end - start;
	return {
		id: `seg_${i}`,
		index: i,
		start,
		end,
		source: "src",
		translated: "",
		status: "ready",
		speedMode: "auto",
		timing: {
			originalDuration: 0,
			targetDuration: target,
			fittedDuration: target,
			appliedSpeedup: 1,
		},
	};
}

describe("coherence timing", () => {
	test("short lines slow down (≥ MIN_NATURAL_RATE) instead of leaving dead air", () => {
		// 2.5s Chinese in a 4s slot used to play at 1.0 → 1.5s silence
		const rate = autoFitSpeed({
			originalDuration: 2.5,
			targetDuration: 4,
			maxSpeedup: 2.3,
		});
		expect(rate).toBeLessThan(1);
		expect(rate).toBeGreaterThanOrEqual(MIN_NATURAL_RATE);
	});

	test("long lines still speed up, clamped to maxSpeedup", () => {
		expect(
			autoFitSpeed({ originalDuration: 8, targetDuration: 4, maxSpeedup: 2.3 }),
		).toBe(2);
		expect(
			autoFitSpeed({ originalDuration: 20, targetDuration: 4, maxSpeedup: 2.3 }),
		).toBe(2.3);
	});

	test("extendSlots absorbs inter-cue silence (minus guard), capped", () => {
		// 1s gap between seg0.end(4) and seg1.start(5)
		const [a, b] = extendSlots({ segments: [seg(0, 0, 4), seg(1, 5, 8)] });
		expect(a.timing.targetDuration).toBeCloseTo(4.92, 1); // 5 - 0.08 - 0
		// last segment: capped extension beyond its own end
		expect(b.timing.targetDuration).toBeGreaterThan(3);
		expect(b.timing.targetDuration).toBeLessThanOrEqual(3 + 1.5 + 0.01);
	});

	test("extendSlots caps absorption at 1.5s for huge gaps", () => {
		const [a] = extendSlots({ segments: [seg(0, 0, 4), seg(1, 20, 24)] });
		expect(a.timing.targetDuration).toBeCloseTo(5.5, 5); // 4 + 1.5 cap
	});

	test("extendSlots never shrinks a slot (tight/overlapping cues unchanged)", () => {
		const [a] = extendSlots({ segments: [seg(0, 0, 4), seg(1, 4, 8)] });
		expect(a.timing.targetDuration).toBe(4);
	});
});
