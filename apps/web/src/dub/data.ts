import type { Voice } from "@/dub/types";

// Voice gallery (TTS speakers). ids map to Volcengine speaker names (zh-dub).
export const VOICES: Voice[] = [
	{
		id: "zh_male_liufei_uranus_bigtts",
		name: "刘飞",
		genderLabel: "男声",
		style: "沉稳磁性",
		desc: "适合知识讲解、纪录片",
		hue: 255,
		recommended: true,
	},
	{
		id: "zh_female_xiaowen_bigtts",
		name: "晓雯",
		genderLabel: "女声",
		style: "温柔亲和",
		desc: "适合生活、口播",
		hue: 330,
	},
	{
		id: "zh_male_zimo_bigtts",
		name: "子默",
		genderLabel: "男声",
		style: "清亮干练",
		desc: "适合科技、商务",
		hue: 200,
	},
	{
		id: "zh_female_anna_news_bigtts",
		name: "安娜",
		genderLabel: "女声",
		style: "知性播报",
		desc: "适合新闻、资讯",
		hue: 150,
	},
	{
		id: "zh_male_yangguang_bigtts",
		name: "阳光",
		genderLabel: "男声",
		style: "热情活力",
		desc: "适合广告、Vlog",
		hue: 40,
	},
	{
		id: "zh_female_lin_warm_bigtts",
		name: "林笙",
		genderLabel: "女声",
		style: "温暖叙事",
		desc: "适合故事、有声书",
		hue: 290,
	},
];

export function voiceById({ id }: { id: string }): Voice | undefined {
	return VOICES.find((v) => v.id === id);
}
