// Stage: synthesize — concurrent 豆包 TTS for every translated line (8-way),
// decoding each clip's REAL duration on the shared AudioContext to drive the
// variable-speed fit. Single-line failures retry once, then are recorded; the
// lesson only fails if more than 10% of lines are unsynthesizable.

import { Semaphore } from "@/dub/course/engine/semaphore";
import { getSharedAudioContext } from "@/dub/audio-context";
import { synthesizeSegment } from "@/dub/tts";
import { autoFitSpeed } from "@/dub/timing";
import type { DubCredentials } from "@/dub/credentials";
import type { DubSettings, Segment } from "@/dub/types";
import type { StepReport, SynthesizedClip } from "@/dub/course/engine/types";

const TTS_CONCURRENCY = 8;

export async function synthesizeLesson({
	segments,
	settings,
	creds,
	onStep,
	signal,
}: {
	segments: Segment[];
	settings: DubSettings;
	creds: DubCredentials;
	onStep?: (args: StepReport) => void;
	signal?: AbortSignal;
}): Promise<SynthesizedClip[]> {
	const dubbable = segments.filter((s) => s.translated.trim().length > 0);
	if (dubbable.length === 0) {
		throw new Error("没有可配音的句子（请先翻译）");
	}

	const sem = new Semaphore(TTS_CONCURRENCY);
	const audioCtx = getSharedAudioContext();
	const clips: SynthesizedClip[] = [];
	const failures: string[] = [];
	let done = 0;

	const synthOne = async (seg: Segment): Promise<void> => {
		const attempt = () =>
			synthesizeSegment({
				text: seg.translated,
				voiceType: settings.voiceId,
				creds,
			});
		let bytes: ArrayBuffer;
		try {
			bytes = await attempt();
		} catch {
			// one retry — transient TTS hiccups are common at 8-way concurrency
			try {
				bytes = await attempt();
			} catch (error) {
				failures.push(
					`${seg.id}: ${error instanceof Error ? error.message : "TTS 失败"}`,
				);
				return;
			}
		}

		let realDuration = seg.timing.targetDuration;
		try {
			const decoded = await audioCtx.decodeAudioData(bytes.slice(0));
			if (decoded.duration > 0) realDuration = decoded.duration;
		} catch {
			// fall back to the slot length if the mp3 fails to decode
		}

		const rate =
			seg.speedMode === "manual"
				? seg.timing.appliedSpeedup
				: autoFitSpeed({
						originalDuration: realDuration,
						targetDuration: seg.timing.targetDuration,
						maxSpeedup: settings.maxSpeedup,
					});
		clips.push({
			segId: seg.id,
			bytes,
			realDuration,
			rate: Number(rate.toFixed(3)),
			fitted: rate > 0 ? realDuration / rate : realDuration,
		});
		done++;
		onStep?.({
			step: `合成配音 ${done}/${dubbable.length}`,
			pct: Math.round((done / dubbable.length) * 100),
		});
	};

	await Promise.all(
		dubbable.map((seg) => sem.withPermit(() => synthOne(seg), signal)),
	);

	if (failures.length > dubbable.length * 0.1) {
		throw new Error(
			`TTS 失败过多（${failures.length}/${dubbable.length}）：${failures[0]}`,
		);
	}

	// keep timeline order deterministic regardless of completion order
	const order = new Map(dubbable.map((s, i) => [s.id, i]));
	clips.sort((a, b) => (order.get(a.segId) ?? 0) - (order.get(b.segId) ?? 0));
	return clips;
}
