import { create } from "zustand";
import { persist } from "zustand/middleware";
import { VOICES } from "@/dub/data";
import type { Voice } from "@/dub/types";

// User-added TTS voices (any Volcengine BigTTS voice_type), persisted in
// localStorage GLOBALLY — voices are account-level, not per-project. Presets
// in data.ts stay read-only; this store only holds the user's additions.

interface CustomVoicesStore {
	voices: Voice[];
	addVoice: (args: { voice: Voice }) => void;
	removeVoice: (args: { id: string }) => void;
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
			voices: [],
			addVoice: ({ voice }) =>
				set((s) => ({
					voices: [...s.voices.filter((v) => v.id !== voice.id), voice],
				})),
			removeVoice: ({ id }) =>
				set((s) => ({ voices: s.voices.filter((v) => v.id !== id) })),
		}),
		{ name: "dub-custom-voices-v1" },
	),
);

/** Presets + user-added voices, for any picker UI. */
export function useAllVoices(): Voice[] {
	const custom = useCustomVoices((s) => s.voices);
	return [...VOICES, ...custom];
}
