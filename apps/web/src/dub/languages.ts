// Target/source languages for the dubbing pipeline — the language set mirrors
// the locales Apple ships on apple.com. Single source of truth for: speech-rate
// heuristics (duration estimation), filename language-tag detection (course
// scan pairing), export suffixes and display labels.
//
// `code` values are stable identifiers persisted in sessions — "zh" is kept
// (not "zh-Hans") so existing Chinese sessions keep working unchanged.

export interface DubLanguage {
	code: string;
	/** native display name, e.g. 简体中文 / English / 日本語 */
	label: string;
	/** seconds of speech per non-whitespace character (estimation heuristic) */
	secondsPerChar: number;
	/** filename tail tags that mark a subtitle as this language (lowercase) */
	tagAliases: string[];
	/** short export-file suffix: `${stem}_${suffix}.mp4` */
	suffix: string;
	/**
	 * 豆包 BigTTS synthesis support. Per official docs the 多语种大模型音色
	 * speak ONLY 中文/英文/日文/西班牙文 (4 languages) — absent means the
	 * language can be translated/subtitled but NOT voiced. `explicit` is the
	 * `audio.explicit_language` request value; null means the default Chinese
	 * pipeline (no parameter sent — keeps zh behavior bit-equal).
	 */
	tts?: { explicit: string | null };
}

/** sourceLang sentinel — let Whisper detect the language itself. */
export const AUTO_LANG = "auto";

const LATIN_RATE = 0.08;

export const LANGUAGES: DubLanguage[] = [
	{
		code: "zh",
		label: "简体中文",
		secondsPerChar: 0.19,
		tagAliases: ["zh", "zh-cn", "zh-hans", "cn", "chs", "chi", "chinese"],
		suffix: "zh",
		tts: { explicit: null },
	},
	{
		code: "zh-Hant",
		label: "繁體中文",
		secondsPerChar: 0.19,
		tagAliases: ["zh-tw", "zh-hant", "zh-hk", "cht", "tc"],
		suffix: "zh-tw",
		tts: { explicit: null },
	},
	{
		code: "en",
		label: "English",
		secondsPerChar: LATIN_RATE,
		tagAliases: ["en", "eng", "english", "en-us", "en-gb"],
		suffix: "en",
		tts: { explicit: "en" },
	},
	{
		code: "ja",
		label: "日本語",
		secondsPerChar: 0.115,
		tagAliases: ["ja", "jp", "jpn", "japanese"],
		suffix: "ja",
		tts: { explicit: "ja" },
	},
	{
		code: "ko",
		label: "한국어",
		secondsPerChar: 0.16,
		tagAliases: ["ko", "kr", "kor", "korean"],
		suffix: "ko",
	},
	{
		code: "es",
		label: "Español",
		secondsPerChar: 0.075,
		tagAliases: ["es", "spa", "spanish", "es-es", "es-mx", "es-419"],
		suffix: "es",
		tts: { explicit: "es-mx" },
	},
	{
		code: "fr",
		label: "Français",
		secondsPerChar: LATIN_RATE,
		tagAliases: ["fr", "fra", "fre", "french", "fr-fr", "fr-ca"],
		suffix: "fr",
	},
	{
		code: "de",
		label: "Deutsch",
		secondsPerChar: 0.085,
		tagAliases: ["de", "deu", "ger", "german", "de-de"],
		suffix: "de",
	},
	{
		code: "it",
		label: "Italiano",
		secondsPerChar: 0.075,
		tagAliases: ["it", "ita", "italian"],
		suffix: "it",
	},
	{
		code: "pt",
		label: "Português",
		secondsPerChar: 0.075,
		tagAliases: ["pt", "por", "portuguese", "pt-br", "pt-pt"],
		suffix: "pt",
	},
	{
		code: "nl",
		label: "Nederlands",
		secondsPerChar: LATIN_RATE,
		tagAliases: ["nl", "nld", "dut", "dutch"],
		suffix: "nl",
	},
	{
		code: "sv",
		label: "Svenska",
		secondsPerChar: LATIN_RATE,
		tagAliases: ["sv", "swe", "swedish"],
		suffix: "sv",
	},
	{
		code: "no",
		label: "Norsk",
		secondsPerChar: LATIN_RATE,
		tagAliases: ["no", "nb", "nor", "norwegian"],
		suffix: "no",
	},
	{
		code: "da",
		label: "Dansk",
		secondsPerChar: LATIN_RATE,
		tagAliases: ["da", "dan", "danish"],
		suffix: "da",
	},
	{
		code: "fi",
		label: "Suomi",
		secondsPerChar: 0.085,
		tagAliases: ["fi", "fin", "finnish"],
		suffix: "fi",
	},
	{
		code: "pl",
		label: "Polski",
		secondsPerChar: 0.085,
		tagAliases: ["pl", "pol", "polish"],
		suffix: "pl",
	},
	{
		code: "cs",
		label: "Čeština",
		secondsPerChar: 0.085,
		tagAliases: ["cs", "cze", "ces", "czech"],
		suffix: "cs",
	},
	{
		code: "hu",
		label: "Magyar",
		secondsPerChar: 0.085,
		tagAliases: ["hu", "hun", "hungarian"],
		suffix: "hu",
	},
	{
		code: "tr",
		label: "Türkçe",
		secondsPerChar: 0.085,
		tagAliases: ["tr", "tur", "turkish"],
		suffix: "tr",
	},
	{
		code: "ru",
		label: "Русский",
		secondsPerChar: 0.095,
		tagAliases: ["ru", "rus", "russian"],
		suffix: "ru",
	},
	{
		code: "ar",
		label: "العربية",
		secondsPerChar: 0.085,
		tagAliases: ["ar", "ara", "arabic"],
		suffix: "ar",
	},
	{
		code: "he",
		label: "עברית",
		secondsPerChar: 0.09,
		tagAliases: ["he", "heb", "hebrew", "iw"],
		suffix: "he",
	},
	{
		code: "th",
		label: "ไทย",
		secondsPerChar: 0.105,
		tagAliases: ["th", "tha", "thai"],
		suffix: "th",
	},
	{
		code: "vi",
		label: "Tiếng Việt",
		secondsPerChar: 0.09,
		tagAliases: ["vi", "vie", "vietnamese"],
		suffix: "vi",
	},
	{
		code: "id",
		label: "Bahasa Indonesia",
		secondsPerChar: LATIN_RATE,
		tagAliases: ["id", "ind", "indonesian"],
		suffix: "id",
	},
	{
		code: "ms",
		label: "Bahasa Melayu",
		secondsPerChar: LATIN_RATE,
		tagAliases: ["ms", "msa", "may", "malay"],
		suffix: "ms",
	},
];

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));
// alias → canonical code, longest-first so "zh-cn" wins over "cn" in regex
const byAlias = new Map<string, string>();
for (const l of LANGUAGES) {
	for (const a of l.tagAliases) byAlias.set(a, l.code);
}

/** Unknown/legacy codes fall back to Chinese — the original behavior. */
export function languageByCode(code: string): DubLanguage {
	return byCode.get(code) ?? LANGUAGES[0];
}

const ALL_ALIASES = [...byAlias.keys()].sort((a, b) => b.length - a.length);
const TAG_RE = new RegExp(
	`[_.\\-](${ALL_ALIASES.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`,
	"i",
);

/** Detect a trailing language tag in a subtitle stem; null when untagged. */
export function detectLangTag(stem: string): string | null {
	const m = stem.toLowerCase().match(TAG_RE);
	return m ? (byAlias.get(m[1]) ?? null) : null;
}

/** Strip a trailing language tag so "foo_en" / "foo.zh-cn" pair with "foo". */
export function stripLangTag(stem: string): string {
	return stem.toLowerCase().replace(TAG_RE, "");
}

/**
 * Map a source-language setting to what Whisper expects: "auto" passes
 * through (both backends already treat it as detect-language), regional
 * codes collapse to their ISO 639-1 base ("zh-Hant" → "zh").
 */
export function toWhisperLanguage(sourceLang: string): string {
	if (sourceLang === AUTO_LANG) return "auto";
	return sourceLang.split("-")[0].toLowerCase();
}

/** Whether 豆包 BigTTS can actually voice this language. */
export function ttsSupported(code: string): boolean {
	return languageByCode(code).tts !== undefined;
}

/** `audio.explicit_language` value for the TTS request; undefined = omit. */
export function ttsExplicitLanguage(code: string): string | undefined {
	return languageByCode(code).tts?.explicit ?? undefined;
}

/** Labels of all voiceable languages, for error/hint copy. */
export function ttsSupportedLabels(): string {
	return LANGUAGES.filter((l) => l.tts)
		.map((l) => l.label)
		.join("、");
}
