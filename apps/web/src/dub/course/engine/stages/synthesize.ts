// Stage: synthesize — concurrent 豆包 TTS for every translated line (8-way),
// decoding each clip's REAL duration on the shared AudioContext to drive the
// variable-speed fit. Single-line failures retry once, then are recorded; the
// lesson only fails if more than 10% of lines are unsynthesizable.
//
// TWO-STAGE speed fitting (spec dub-quality v2 §2): lines that need speeding
// are first synthesized FASTER natively (TTS speed_ratio, ≤ nativeMaxSpeed —
// sounds human), and only the residual is covered by mechanical retime. The
// old single-stage retime made every ≥1.2× line sound robotic.

import { Semaphore } from "@/dub/course/engine/semaphore";
import { getSharedAudioContext } from "@/dub/audio-context";
import { synthesizeSegment } from "@/dub/tts";
import { autoFitSpeed, estimateDuration, MIN_NATURAL_RATE } from "@/dub/timing";
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
		// Stage 1 — native TTS speed: estimate how much this line must be
		// compressed and let the voice itself speak faster (natural) up to
		// nativeMaxSpeed. Manual lines skip this (the user dialed a rate).
		const target = seg.timing.targetDuration;
		const estimated = estimateDuration({ text: seg.translated });
		const nativeRatio =
			seg.speedMode === "manual" || !settings.speedAdaptive || target <= 0
				? 1
				: Math.min(
						Math.max(estimated / target, 1),
						Math.max(1, settings.nativeMaxSpeed),
					);

		const attempt = () =>
			synthesizeSegment({
				text: seg.translated,
				voiceType: settings.voiceId,
				creds,
				speedRatio: Number(nativeRatio.toFixed(2)),
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

		let realDuration = target;
		try {
			const decoded = await audioCtx.decodeAudioData(bytes.slice(0));
			if (decoded.duration > 0) realDuration = decoded.duration;
		} catch {
			// fall back to the slot length if the mp3 fails to decode
		}

		// Stage 2 — mechanical retime covers only the residual. Total speed-up
		// (native × retime) stays within maxSpeedup.
		const residualCap = Math.max(1, settings.maxSpeedup / nativeRatio);
		const retime =
			seg.speedMode === "manual"
				? seg.timing.appliedSpeedup
				: autoFitSpeed({
						originalDuration: realDuration,
						targetDuration: target,
						maxSpeedup: residualCap,
					});
		const rate = Math.max(retime, MIN_NATURAL_RATE);
		clips.push({
			segId: seg.id,
			bytes,
			realDuration,
			rate: Number(rate.toFixed(3)),
			// totalSpeedup drives the ⚡/超时 flags — what the listener perceives
			totalSpeedup: Number((nativeRatio * rate).toFixed(3)),
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
