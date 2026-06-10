import { describe, expect, test } from "bun:test";
import {
	addSubtitleToMap,
	pairVideoWithSubtitles,
	type SubtitleMap,
} from "@/dub/course/scan";

// Handles are opaque to the pairing logic — a tagged stub is enough.
const h = (tag: string) => ({ tag }) as unknown as FileSystemFileHandle;

function mapOf(...names: string[]): SubtitleMap {
	const map: SubtitleMap = new Map();
	for (const n of names) addSubtitleToMap({ map, fileName: n, handle: h(n) });
	return map;
}

describe("subtitle pairing", () => {
	test("pairs exact stem (foo.mp4 ↔ foo.srt) as English", () => {
		const r = pairVideoWithSubtitles({ videoName: "foo.mp4", subs: mapOf("foo.srt") });
		expect(r.subtitleLang).toBe("en");
		expect(r.subtitleHandle).not.toBeNull();
	});

	test("strips _en language tag (lesson.mp4 ↔ lesson_en.srt)", () => {
		const r = pairVideoWithSubtitles({
			videoName: "lesson.mp4",
			subs: mapOf("lesson_en.srt"),
		});
		expect(r.subtitleLang).toBe("en");
	});

	test("detects Chinese variants and prefers zh over en", () => {
		for (const zh of ["a.zh-cn.vtt", "a_zh.srt", "a_chs.srt", "a.chinese.srt"]) {
			const r = pairVideoWithSubtitles({
				videoName: "a.mp4",
				subs: mapOf("a_en.srt", zh),
			});
			expect(r.subtitleLang).toBe("zh");
		}
	});

	test("subs/-folder entries pair via the same map (merge model)", () => {
		// scan merges subs/video.en.srt into the parent's map before pairing —
		// equivalent to it having been in the same directory.
		const r = pairVideoWithSubtitles({
			videoName: "video.mp4",
			subs: mapOf("video.en.srt"),
		});
		expect(r.subtitleLang).toBe("en");
	});

	test("no match → null (numeric stems don't false-positive)", () => {
		const r = pairVideoWithSubtitles({
			videoName: "1_00090000.mp4",
			subs: mapOf("other.srt"),
		});
		expect(r.subtitleLang).toBeNull();
		expect(r.subtitleHandle).toBeNull();
	});

	test("first handle per language wins (same-dir beats subs/)", () => {
		const map: SubtitleMap = new Map();
		addSubtitleToMap({ map, fileName: "x.srt", handle: h("same-dir") });
		addSubtitleToMap({ map, fileName: "x_en.srt", handle: h("subs-dir") });
		const r = pairVideoWithSubtitles({ videoName: "x.mp4", subs: map });
		expect((r.subtitleHandle as unknown as { tag: string }).tag).toBe("same-dir");
	});
});
