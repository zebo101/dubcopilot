import { describe, expect, test } from "bun:test";
import { packDubUnits } from "@/dub/units";
import type { Segment } from "@/dub/types";

function seg(
	i: number,
	start: number,
	end: number,
	zh: string,
	opts: { ext?: number; manual?: number } = {},
): Segment {
	return {
		id: `seg_${i}`,
		index: i,
		start,
		end,
		source: "src",
		translated: zh,
		status: "ready",
		speedMode: opts.manual !== undefined ? "manual" : "auto",
		timing: {
			originalDuration: 0,
			targetDuration: opts.ext ?? end - start,
			fittedDuration: opts.ext ?? end - start,
			appliedSpeedup: opts.manual ?? 1,
		},
	};
}

const SETTINGS = { nativeMaxSpeed: 1.35 };

describe("packDubUnits", () => {
	test("a tiny sentence (Okay. 0.4s slot) is absorbed into the adjacent unit", () => {
		const units = packDubUnits({
			segments: [
				seg(0, 0, 3, "我们来测试一下 Node.js，看看它运行得怎么样。"),
				seg(1, 3.1, 3.5, "好的。"), // 0.4s slot — the killer case
				seg(2, 3.7, 7, "现在它已经安装完成了。"),
			],
			settings: SETTINGS,
		});
		expect(units.length).toBeLessThan(3);
		const all = units.flatMap((u) => u.segIds);
		expect(all).toEqual(["seg_0", "seg_1", "seg_2"]); // order + coverage
		// the tiny one is not alone
		const tinyUnit = units.find((u) => u.segIds.includes("seg_1"));
		expect(tinyUnit!.segIds.length).toBeGreaterThan(1);
	});

	test("a comfortable sentence with a real gap after it stays alone", () => {
		const units = packDubUnits({
			segments: [
				seg(0, 0, 5, "这是一句时长充裕的话。"), // 5s slot, ~2.4s zh
				seg(1, 7, 12, "停顿两秒后的下一句也很充裕。"),
			],
			settings: SETTINGS,
		});
		expect(units).toHaveLength(2);
	});

	test("an oversized sentence keeps absorbing followers until it fits", () => {
		// 1.5s slot but a LONG zh line → must chain into following slots
		const units = packDubUnits({
			segments: [
				seg(0, 0, 1.5, "这一句的中文译文特别特别长，原始槽位完全装不下这么多内容。"),
				seg(1, 1.6, 4, "后面这句的槽位比较宽松。"),
				seg(2, 4.2, 8, "再后面还有一句宽松的。"),
			],
			settings: SETTINGS,
		});
		const first = units[0];
		expect(first.segIds.length).toBeGreaterThanOrEqual(2);
		expect(first.start).toBe(0);
	});

	test("chains break at gaps > 0.75s even when tight", () => {
		const units = packDubUnits({
			segments: [
				seg(0, 0, 0.8, "很短。"),
				seg(1, 2.0, 2.8, "也很短。"), // 1.2s gap — separate speech run
			],
			settings: SETTINGS,
		});
		expect(units).toHaveLength(2);
	});

	test("span cap 14s forces a unit boundary", () => {
		const segs = Array.from({ length: 8 }, (_, i) =>
			seg(i, i * 2.2, i * 2.2 + 2.1, "这句中文长度装不进自己的槽位需要借用。"),
		);
		const units = packDubUnits({ segments: segs, settings: SETTINGS });
		for (const u of units) {
			expect(u.span).toBeLessThanOrEqual(14.01);
		}
	});

	test("manual-speed lines are standalone units and break chains", () => {
		const units = packDubUnits({
			segments: [
				seg(0, 0, 0.5, "短。"),
				seg(1, 0.6, 1.0, "手动调速句。", { manual: 1.5 }),
				seg(2, 1.1, 1.5, "又短。"),
			],
			settings: SETTINGS,
		});
		const manualUnit = units.find((u) => u.segIds.includes("seg_1"));
		expect(manualUnit!.segIds).toEqual(["seg_1"]);
		expect(manualUnit!.manualRate).toBe(1.5);
	});

	test("unit text concatenates member translations in order", () => {
		const units = packDubUnits({
			segments: [seg(0, 0, 0.5, "好的。"), seg(1, 0.6, 1.0, "我们继续。")],
			settings: SETTINGS,
		});
		expect(units[0].text).toBe("好的。我们继续。");
	});

	test("zh regression: explicit targetLang 'zh' packs exactly like the default", () => {
		const segs = [
			seg(0, 0, 3, "我们来测试一下 Node.js，看看它运行得怎么样。"),
			seg(1, 3.1, 3.5, "好的。"),
			seg(2, 3.7, 7, "现在它已经安装完成了。"),
		];
		const def = packDubUnits({ segments: segs, settings: SETTINGS });
		const zh = packDubUnits({
			segments: segs,
			settings: { ...SETTINGS, targetLang: "zh" },
		});
		expect(zh).toEqual(def);
	});

	test("language rate changes packing: same text fits an en slot but not a zh one", () => {
		// 30 chars ≈ 30×0.19+0.3 ≈ 6.0s spoken as zh — far over a 2.6s slot even
		// at ×1.35; as English (0.08 s/char) ≈ 2.7s — fits natively. So the zh
		// run must absorb the follower while the en run leaves it standalone.
		const text = "abcdefghijklmnopqrstuvwxyzabcd";
		const segs = () => [
			seg(0, 0, 2.6, text),
			seg(1, 2.7, 6.4, "follower line"),
		];
		const zhUnits = packDubUnits({
			segments: segs(),
			settings: { ...SETTINGS, targetLang: "zh" },
		});
		const enUnits = packDubUnits({
			segments: segs(),
			settings: { ...SETTINGS, targetLang: "en" },
		});
		expect(zhUnits).toHaveLength(1); // chained to borrow the next slot
		expect(enUnits).toHaveLength(2); // fits natively — no need to chain
	});
});
