import { create } from "zustand";
import { persist } from "zustand/middleware";
import { VOICES } from "@/dub/data";
import type { Voice } from "@/dub/types";

// User-managed TTS voices (any Volcengine BigTTS voice_type), persisted in
// localStorage GLOBALLY — voices are account-level, not per-project. The
// DEFAULT_CUSTOM_VOICES below SEED the list on first run (new user/browser);
// after that the user owns it fully — every entry is deletable, and
// restoreDefaults() merges the seeds back in. data.ts keeps only 刘飞 as the
// non-deletable fallback.

/** Curated default voice set — seeded once, then fully user-editable. */
export const DEFAULT_CUSTOM_VOICES: Voice[] = [
	{
		id: "zh_female_lingling_uranus_bigtts",
		name: "玲玲姐 2.0",
		genderLabel: "自定义",
		style: "女声",
		desc: "女声",
		hue: 343,
	},
	{
		id: "zh_male_ruyayichen_uranus_bigtts",
		name: "儒雅逸辰 2.0",
		genderLabel: "自定义",
		style: "男声 · 气泡音",
		desc: "男声 · 气泡音",
		hue: 339,
	},
	{
		id: "zh_male_dayi_uranus_bigtts",
		name: "大壹",
		genderLabel: "自定义",
		style: "男声 · 沉稳",
		desc: "男声 · 沉稳",
		hue: 343,
	},
	{
		id: "zh_male_wennuanahu_uranus_bigtts",
		name: "温暖阿虎/Alvin 2.0",
		genderLabel: "自定义",
		style: "男声 · 温暖",
		desc: "男声 · 温暖",
		hue: 234,
	},
	{
		id: "zh_female_sophie_uranus_bigtts",
		name: "魅力苏菲 2.0",
		genderLabel: "自定义",
		style: "女声 · 高冷御姐",
		desc: "高冷御姐，外表疏离难亲近，内心却细腻柔软",
		hue: 213,
	},
	{
		id: "zh_female_wanwanxiaohe_moon_bigtts",
		name: "湾湾小何",
		genderLabel: "自定义",
		style: "女声 · 甜美台湾腔",
		desc: "甜美夹子音女",
		hue: 72,
	},
	{
		id: "zh_male_zhoujielun_emo_v2_mars_bigtts",
		name: "台湾口音",
		genderLabel: "自定义",
		style: "男声 · 台湾腔",
		desc: "男声 · 台湾腔",
		hue: 123,
	},
	{
		id: "multi_zh_male_youyoujunzi_moon_bigtts",
		name: "ひかる(光)",
		genderLabel: "自定义",
		style: "男声 · 日语",
		desc: "日语男声",
		hue: 235,
	},
	{
		id: "multi_female_sophie_conversation_wvae_bigtts",
		name: "さとみ(智美)",
		genderLabel: "自定义",
		style: "女声 · 日语",
		desc: "日语女声",
		hue: 301,
	},
	{
		id: "multi_male_xudong_conversation_wvae_bigtts",
		name: "Sofia",
		genderLabel: "自定义",
		style: "西班牙语",
		desc: "西班牙语",
		hue: 195,
	},
	{
		id: "en_female_candice_emo_v2_mars_bigtts",
		name: "Candice",
		genderLabel: "自定义",
		style: "女声 · 美式英语 · 多情感",
		desc: "女生 US 英语 多情感，美式英语",
		hue: 9,
	},
	{
		id: "en_male_glen_emo_v2_mars_bigtts",
		name: "Glen",
		genderLabel: "自定义",
		style: "男声 · 美式英语 · 多情感",
		desc: "男生 US 英语 多情感，美式英语",
		hue: 9,
	},
	{
		id: "en_female_nadia_tips_emo_v2_mars_bigtts",
		name: "Nadia",
		genderLabel: "自定义",
		style: "女声 · 英式英语 · 甜美温柔",
		desc: "音色甜美温柔，英式英语",
		hue: 162,
	},
	{
		id: "en_male_corey_emo_v2_mars_bigtts",
		name: "Corey",
		genderLabel: "自定义",
		style: "男声 · 英式英语 · 温润成熟",
		desc: "声音治愈温润的男性声音，温暖成熟，擅长英式英语",
		hue: 221,
	},
];

interface CustomVoicesStore {
	voices: Voice[];
	addVoice: (args: { voice: Voice }) => void;
	removeVoice: (args: { id: string }) => void;
	/** merge the default set back in (deleted defaults reappear; additions kept) */
	restoreDefaults: () => void;
}

/** Stable hue from the voice id so each custom voice gets its own color. */
export function hueFromId(id: string): number {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % 360;
}

export const useCustomVoices = create<CustomVoicesStore>()(
	persist(
		(set) => ({
			// first run (nothing persisted yet) starts seeded with the defaults;
			// once persisted, the user's list — including deletions — wins
			voices: DEFAULT_CUSTOM_VOICES,
			addVoice: ({ voice }) =>
				set((s) => ({
					voices: [...s.voices.filter((v) => v.id !== voice.id), voice],
				})),
			removeVoice: ({ id }) =>
				set((s) => ({ voices: s.voices.filter((v) => v.id !== id) })),
			restoreDefaults: () =>
				set((s) => ({
					voices: [
						...DEFAULT_CUSTOM_VOICES,
						...s.voices.filter(
							(v) => !DEFAULT_CUSTOM_VOICES.some((d) => d.id === v.id),
						),
					],
				})),
		}),
		{ name: "dub-custom-voices-v1" },
	),
);

/** Presets + user-added voices, for any picker UI. */
export function useAllVoices(): Voice[] {
	const custom = useCustomVoices((s) => s.voices);
	return [...VOICES, ...custom];
}
