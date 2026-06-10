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
import {
	autoFitSpeed,
	estimateDuration,
	fitClip,
	MIN_NATURAL_RATE,
} from "@/dub/timing";
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
		// Stage 1 — native TTS speed: estimate the compression/stretch this line
		// needs and let the VOICE itself absorb it (sounds human in both
		// directions: 豆包 speed_ratio supports <1 too). Mechanical retime is
		// reserved for residual COMPRESSION only — slowing a clip via SoundTouch
		// added stretch artifacts to every short line.
		const target = seg.timing.targetDuration;
		const estimated = estimateDuration({ text: seg.translated });
		const nativeRatio =
			seg.speedMode === "manual" || !settings.speedAdaptive || target <= 0
				? 1
				: Math.min(
						Math.max(estimated / target, MIN_NATURAL_RATE),
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

		// Stage 2 — mechanical retime covers residual COMPRESSION only (≥ 1;
		// stretching is the TTS's job now). Total native × retime ≤ maxSpeedup.
		const residualCap = Math.max(1, settings.maxSpeedup / nativeRatio);
		const retime =
			seg.speedMode === "manual"
				? Math.max(seg.timing.appliedSpeedup, 1)
				: Math.max(
						1,
						autoFitSpeed({
							originalDuration: realDuration,
							targetDuration: target,
							maxSpeedup: residualCap,
						}),
					);
		const { fitted, rate } = fitClip({ realDuration, retime });
		clips.push({
			segId: seg.id,
			bytes,
			realDuration,
			rate,
			// totalSpeedup drives the ⚡/超时 flags — what the listener perceives
			totalSpeedup: Number((nativeRatio * rate).toFixed(3)),
			fitted,
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
