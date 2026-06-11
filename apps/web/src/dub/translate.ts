import type { DubCredentials } from "@/dub/credentials";
import { languageByCode } from "@/dub/languages";
import type { Segment } from "@/dub/types";

// Smaller batches translate far more reliably than large ones: with 20+ items
// the model tends to silently drop entries from the JSON array, which left gaps
// in the dub. 10 keeps each request comfortably within a single clean response.
const BATCH_SIZE = 10;
// How many extra passes to recover any ids the model skipped.
const MAX_RETRY_ROUNDS = 3;

async function requestBatch({
	items,
	creds,
	targetLabel,
}: {
	items: { id: string; text: string }[];
	creds: DubCredentials;
	targetLabel: string;
}): Promise<{ id: string; text: string }[]> {
	let res: Response;
	try {
		res = await fetch("/api/dub/translate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				apiKey: creds.deepseekApiKey,
				baseUrl: creds.deepseekBaseUrl,
				model: creds.deepseekModel,
				targetLabel,
				items,
			}),
			// a 10-item batch finishes well under 2 min — only a STALLED
			// connection trips this; the retry rounds then re-request those ids
			signal: AbortSignal.timeout(120_000),
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "TimeoutError") {
			throw new Error("翻译请求超时（网络不稳定，将自动补译）");
		}
		throw error;
	}
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as { error?: string };
		throw new Error(err.error ?? `翻译请求失败 (${res.status})`);
	}
	// route normalizes to "text"; tolerate legacy "zh" from older deployments
	const { translations } = (await res.json()) as {
		translations: { id: string; text?: string; zh?: string }[];
	};
	return (Array.isArray(translations) ? translations : []).map((t) => ({
		id: t.id,
		text: t.text ?? t.zh ?? "",
	}));
}

function chunk<T>({ list, size }: { list: T[]; size: number }): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
	return out;
}

/**
 * Detect a degenerate LLM repetition loop ("new new new new…" / "main main…").
 * Such output must be rejected so the id is retried rather than written to the
 * timeline. Heuristics: an absurdly long line relative to the source, the same
 * token repeated many times in a row, or one token dominating the output.
 */
function looksDegenerate({
	translated,
	source,
}: {
	translated: string;
	source: string;
}): boolean {
	const text = translated.trim();
	if (!text) return true;
	// 1. Wildly longer than the source (a real translation is rarely > ~4x).
	if (text.length > Math.max(40, source.length * 4)) return true;
	const tokens = text.split(/\s+/).filter(Boolean);
	if (tokens.length >= 8) {
		// 2. Same token repeated back-to-back.
		let run = 1;
		let maxRun = 1;
		for (let i = 1; i < tokens.length; i++) {
			if (tokens[i] === tokens[i - 1]) {
				run++;
				maxRun = Math.max(maxRun, run);
			} else {
				run = 1;
			}
		}
		if (maxRun >= 5) return true;
		// 3. One token dominates the whole line.
		const counts = new Map<string, number>();
		for (const tk of tokens) counts.set(tk, (counts.get(tk) ?? 0) + 1);
		const top = Math.max(...counts.values());
		if (top / tokens.length > 0.5) return true;
	}
	return false;
}

/**
 * Translate each segment's source into the TARGET LANGUAGE via the DeepSeek
 * proxy route. Returns a map of segment id → translated text.
 *
 * Robustness is the whole point here: the model occasionally omits items from a
 * batch, and a single batch can fail. We therefore (1) translate in small
 * batches, tolerating per-batch failures instead of discarding everything, then
 * (2) retry whatever ids are still missing, in progressively smaller batches.
 * This is what keeps the applied dub continuous instead of full of gaps.
 */
export async function translateSegments({
	segments,
	creds,
	targetLang = "zh",
	onStep,
}: {
	segments: Segment[];
	creds: DubCredentials;
	/** language code from dub/languages.ts; resolved to its display label */
	targetLang?: string;
	onStep?: (args: { step: string; pct: number }) => void;
}): Promise<Map<string, string>> {
	const targetLabel = languageByCode(targetLang).label;
	const result = new Map<string, string>();
	const pending = segments.filter((s) => s.source.trim().length > 0);
	const total = pending.length;
	if (total === 0) return result;

	const byId = new Map(pending.map((s) => [s.id, s.source] as const));
	const errors: string[] = [];

	const runPass = async ({
		ids,
		size,
		round,
	}: {
		ids: string[];
		size: number;
		round: number;
	}): Promise<void> => {
		const batches = chunk({
			list: ids.map((id) => ({ id, text: byId.get(id) ?? "" })),
			size,
		});
		const applyBatch = async (items: { id: string; text: string }[]) => {
			try {
				const translations = await requestBatch({ items, creds, targetLabel });
				for (const t of translations) {
					const source = byId.get(t.id);
					if (source === undefined || !t.text) continue;
					// Drop repetition-loop garbage so it gets retried, not applied.
					if (looksDegenerate({ translated: t.text, source })) continue;
					result.set(t.id, t.text);
				}
			} catch (error) {
				errors.push(error instanceof Error ? error.message : String(error));
			}
			onStep?.({
				step:
					round === 0
						? `DeepSeek 翻译中 ${Math.min(result.size, total)}/${total}`
						: `补译遗漏句 ${Math.min(result.size, total)}/${total}`,
				pct: Math.round((result.size / total) * 100),
			});
		};
		// 4 batches in flight — serial batches wasted ~20-30s of dead network
		// time per lesson; the retry rounds already tolerate partial failures.
		const POOL = 4;
		for (let i = 0; i < batches.length; i += POOL) {
			await Promise.allSettled(batches.slice(i, i + POOL).map(applyBatch));
		}
	};

	// First pass over everything.
	await runPass({ ids: pending.map((s) => s.id), size: BATCH_SIZE, round: 0 });

	// Retry passes for any ids the model skipped, shrinking the batch each round
	// so stubborn lines eventually get translated one or two at a time.
	for (let round = 1; round <= MAX_RETRY_ROUNDS; round++) {
		const missing = pending
			.filter((s) => !result.has(s.id))
			.map((s) => s.id);
		if (missing.length === 0) break;
		await runPass({
			ids: missing,
			size: Math.max(1, Math.ceil(BATCH_SIZE / (round + 1))),
			round,
		});
	}

	// Only surface an error if we got nothing at all (e.g. bad key / endpoint) —
	// a few stubborn misses shouldn't throw away an otherwise-good translation.
	if (result.size === 0 && errors.length > 0) {
		throw new Error(errors[0]);
	}
	return result;
}
