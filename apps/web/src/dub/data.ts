import type { Segment, Voice } from "@/dub/types";

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

interface SeedRow {
	start: number;
	end: number;
	source: string;
	translated: string;
	orig: number;
	speed: number;
}

// Mock逐句 seed (real React-course sample from zh-dub). Replaced by real
// transcription in phase 1d; used now to build the逐句编辑台 + playback wiring.
const SEED: SeedRow[] = [
	{ start: 0.0, end: 3.4, source: "Now to get started, let's start by diving into the most important question first.", translated: "现在开始，我们先来看最重要的一个问题。", orig: 3.6, speed: 1.06 },
	{ start: 3.4, end: 6.1, source: "Well, the official website tells us,", translated: "官网是这么说的，", orig: 1.9, speed: 1.0 },
	{ start: 6.1, end: 9.0, source: "and that's a nice sentence, but what exactly does it mean?", translated: "这句话没错，但到底是什么意思呢？", orig: 2.8, speed: 1.0 },
	{ start: 9.0, end: 12.6, source: "We use React in conjunction with our own JavaScript code,", translated: "React 会配合我们自己写的 JavaScript 代码一起用，", orig: 4.6, speed: 1.28 },
	{ start: 12.6, end: 15.0, source: "but it is a library that's there", translated: "不过它本质上是个库，", orig: 1.6, speed: 1.0 },
	{ start: 15.0, end: 17.2, source: "to help us build user interfaces.", translated: "是来帮我们搭建用户界面的。", orig: 2.0, speed: 1.0 },
	{ start: 17.2, end: 20.4, source: "And I might add that it's there to help us build", translated: "补充一句，它尤其擅长帮我们搭建", orig: 3.6, speed: 1.13 },
	{ start: 20.4, end: 22.3, source: "highly interactive user interfaces.", translated: "交互性很强的用户界面。", orig: 1.9, speed: 1.0 },
	{ start: 22.3, end: 24.6, source: "You don't necessarily need React", translated: "React 不一定非得用", orig: 1.7, speed: 1.0 },
	{ start: 24.6, end: 26.6, source: "if you build a simple webpage", translated: "如果你只是做一个简单网页", orig: 1.8, speed: 1.0 },
	{ start: 26.6, end: 29.0, source: "on which not a lot of things are happening.", translated: "页面上也没什么复杂交互。", orig: 2.1, speed: 1.0 },
	{ start: 29.0, end: 32.2, source: "But if you're building a more interactive website", translated: "但如果你做的是一个交互更多的网站", orig: 3.0, speed: 1.0 },
	{ start: 32.2, end: 35.0, source: "like the demo project we're about to build,", translated: "就像我们等会儿要做的演示项目那样，", orig: 3.0, speed: 1.08 },
	{ start: 35.0, end: 37.6, source: "then React.js can be a huge help", translated: "那 React.js 就能帮上大忙", orig: 2.2, speed: 1.0 },
	{ start: 37.6, end: 40.0, source: "vastly simplifying the code you have to write.", translated: "让你少写很多代码。", orig: 1.7, speed: 1.0 },
	{ start: 40.0, end: 42.4, source: "And to show you what I mean,", translated: "我举个例子你就明白了，", orig: 1.9, speed: 1.0 },
	{ start: 42.4, end: 44.8, source: "consider this very simple example here.", translated: "先看这个非常简单的例子。", orig: 1.8, speed: 1.0 },
	{ start: 44.8, end: 48.6, source: "I get this user card where I have this contact button.", translated: "这里有一张用户卡片，上面有个 Contact 按钮。", orig: 4.9, speed: 1.29 },
];

export function buildSeedSegments(): Segment[] {
	return SEED.map((r, i) => {
		const target = r.end - r.start;
		const fitted = r.orig / r.speed;
		return {
			id: `seg_${String(i).padStart(2, "0")}`,
			index: i,
			start: r.start,
			end: r.end,
			source: r.source,
			translated: r.translated,
			status: "ready",
			speedMode: "auto",
			timing: {
				originalDuration: r.orig,
				targetDuration: target,
				fittedDuration: fitted,
				appliedSpeedup: r.speed,
			},
		};
	});
}

export const PIPELINE_STAGES = [
	{ id: "extract", label: "提取音频", detail: "ffmpeg · 单声道 16kHz" },
	{ id: "transcribe", label: "识别原文", detail: "复用字幕 / ASR" },
	{ id: "translate", label: "翻译文本", detail: "英文 → 中文" },
	{ id: "polish", label: "润色译文", detail: "更自然的口语中文" },
	{ id: "tts", label: "合成配音", detail: "TTS 语音合成" },
	{ id: "align", label: "对齐时间轴", detail: "逐句变速对齐 + 混音" },
] as const;
