import { create } from "zustand";
import { persist } from "zustand/middleware";

// User-supplied credentials for the dubbing pipeline. Kept in the FRONTEND
// (localStorage) — never hardcoded. Translation uses DeepSeek (OpenAI-compatible
// chat API); TTS uses Volcengine BigTTS (豆包). Calls go through thin Next API
// proxies (browsers can't reach these endpoints directly — CORS).
export interface DubCredentials {
	// Translation — DeepSeek (V4)
	deepseekApiKey: string;
	deepseekBaseUrl: string;
	deepseekModel: string;
	// 豆包语音 (Volcengine BigTTS, API-key mode)
	ttsApiKey: string;
	ttsResourceId: string;
	ttsUrl: string;
	ttsCluster: string;
}

export const DUB_CREDENTIALS_DEFAULTS: DubCredentials = {
	deepseekApiKey: "",
	deepseekBaseUrl: "https://api.deepseek.com",
	deepseekModel: "deepseek-chat",
	ttsApiKey: "",
	ttsResourceId: "3282640873",
	ttsUrl: "https://openspeech.bytedance.com/api/v1/tts",
	ttsCluster: "volcano_tts",
};

interface DubCredentialsStore extends DubCredentials {
	setField: <K extends keyof DubCredentials>(args: {
		key: K;
		value: DubCredentials[K];
	}) => void;
	reset: () => void;
}

export const useDubCredentials = create<DubCredentialsStore>()(
	persist(
		(set) => ({
			...DUB_CREDENTIALS_DEFAULTS,
			setField: ({ key, value }) =>
				set({ [key]: value } as Partial<DubCredentialsStore>),
			reset: () => set({ ...DUB_CREDENTIALS_DEFAULTS }),
		}),
		{ name: "dub-credentials-v2" },
	),
);

/** Minimum credential for real dubbing audio. */
export function hasTtsKey(c: DubCredentials): boolean {
	return c.ttsApiKey.trim().length > 0;
}

/** Minimum credential for real translation. */
export function hasTranslateKey(c: DubCredentials): boolean {
	return c.deepseekApiKey.trim().length > 0;
}
