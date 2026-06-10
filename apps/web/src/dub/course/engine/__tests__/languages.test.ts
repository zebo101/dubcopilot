import { describe, expect, test } from "bun:test";
import {
	AUTO_LANG,
	LANGUAGES,
	detectLangTag,
	languageByCode,
	stripLangTag,
	toWhisperLanguage,
} from "@/dub/languages";
import { buildTranslateMessages } from "@/dub/translate-prompt";

describe("language registry", () => {
	test("zh stays first and keeps the original speech-rate model", () => {
		expect(LANGUAGES[0].code).toBe("zh");
		expect(LANGUAGES[0].secondsPerChar).toBe(0.19);
	});

	test("languageByCode falls back to Chinese for unknown/legacy codes", () => {
		expect(languageByCode("zh").label).toBe("简体中文");
		expect(languageByCode("klingon").code).toBe("zh");
		expect(languageByCode("").code).toBe("zh");
	});

	test("codes are unique", () => {
		const codes = LANGUAGES.map((l) => l.code);
		expect(new Set(codes).size).toBe(codes.length);
	});

	test("detectLangTag matches aliases of several languages", () => {
		expect(detectLangTag("lesson_en")).toBe("en");
		expect(detectLangTag("lesson.zh-cn")).toBe("zh");
		expect(detectLangTag("lesson_chs")).toBe("zh");
		expect(detectLangTag("lesson_ja")).toBe("ja");
		expect(detectLangTag("lesson.es")).toBe("es");
		expect(detectLangTag("lesson-pt-br")).toBe("pt");
		expect(detectLangTag("lesson_zh-tw")).toBe("zh-Hant");
		expect(detectLangTag("lesson")).toBeNull();
		// longest alias wins: "zh-cn" must not be eaten by the shorter "cn"
		expect(detectLangTag("a.zh-cn")).toBe("zh");
	});

	test("stripLangTag pairs tagged subtitles with their video stem", () => {
		expect(stripLangTag("foo_en")).toBe("foo");
		expect(stripLangTag("foo.zh-cn")).toBe("foo");
		expect(stripLangTag("foo_ja")).toBe("foo");
		expect(stripLangTag("foo")).toBe("foo");
	});

	test("toWhisperLanguage: auto passes through, regions collapse", () => {
		expect(toWhisperLanguage(AUTO_LANG)).toBe("auto");
		expect(toWhisperLanguage("zh-Hant")).toBe("zh");
		expect(toWhisperLanguage("en")).toBe("en");
	});
});

describe("translate prompt target language", () => {
	test("default is Simplified Chinese with the glossary", () => {
		const [system, user] = buildTranslateMessages({
			items: [{ id: "s1", text: "Hello" }],
		});
		expect(system.content).toContain("简体中文");
		expect(system.content).toContain("术语表");
		expect(user.content).toContain("简体中文");
	});

	test("non-Chinese target drops the zh glossary and asks for that language", () => {
		const [system, user] = buildTranslateMessages({
			items: [{ id: "s1", text: "Hello" }],
			targetLabel: "日本語",
		});
		expect(system.content).toContain("日本語");
		expect(system.content).not.toContain("术语表");
		expect(user.content).toContain("日本語");
	});

	test("response schema asks for the neutral 'text' key", () => {
		const [system] = buildTranslateMessages({
			items: [{ id: "s1", text: "Hello" }],
			targetLabel: "Español",
		});
		expect(system.content).toContain('"text"');
		expect(system.content).not.toContain('"zh"');
	});
});
