import type { Voice } from "@/dub/types";

// Built-in voices. Deliberately ONE entry: 刘飞 is the safe Chinese fallback
// (default selection + the target when a selected custom voice is deleted).
// Everything else lives in the user's own list (dub/custom-voices.ts) —
// persistent, addable and deletable at will.
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
];

export function voiceById({ id }: { id: string }): Voice | undefined {
	return VOICES.find((v) => v.id === id);
}
