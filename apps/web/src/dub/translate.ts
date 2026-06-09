import type { DubCredentials } from "@/dub/credentials";
import type { Segment } from "@/dub/types";

const BATCH_SIZE = 20;

/**
 * Translate the (English) source of each segment to Chinese via the DeepSeek
 * proxy route. Returns a map of segment id → Chinese text. Batched for context
 * + token limits.
 */
export async function translateSegments({
	segments,
	creds,
	onStep,
}: {
	segments: Segment[];
	creds: DubCredentials;
	onStep?: (args: { step: string; pct: number }) => void;
}): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	const pending = segments.filter((s) => s.source.trim().length > 0);
	const batches: Segment[][] = [];
	for (let i = 0; i < pending.length; i += BATCH_SIZE) {
		batches.push(pending.slice(i, i + BATCH_SIZE));
	}

	for (let b = 0; b < batches.length; b++) {
		const items = batches[b].map((s) => ({ id: s.id, text: s.source }));
		const res = await fetch("/api/dub/translate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				apiKey: creds.deepseekApiKey,
				baseUrl: creds.deepseekBaseUrl,
				model: creds.deepseekModel,
				items,
			}),
		});
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			throw new Error(err.error ?? `翻译请求失败 (${res.status})`);
		}
		const { translations } = (await res.json()) as {
			translations: { id: string; zh: string }[];
		};
		for (const t of translations) {
			if (t.zh) result.set(t.id, t.zh);
		}
		onStep?.({
			step: `DeepSeek 翻译中 ${Math.min((b + 1) * BATCH_SIZE, pending.length)}/${pending.length}`,
			pct: Math.round(((b + 1) / batches.length) * 100),
		});
	}
	return result;
}
