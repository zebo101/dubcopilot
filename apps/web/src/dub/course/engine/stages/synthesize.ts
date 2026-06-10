// Stage: synthesize — concurrent 豆包 TTS over DUB UNITS (packed speech runs),
// decoding each clip's REAL duration on the shared AudioContext to drive the
// variable-speed fit. One unit = one TTS call = one timeline clip: prosody is
// continuous across the unit's sentences and sub-second fragments ("Okay.")
// can never be squeezed/overlapped on their own.
//
// TWO-STAGE speed fitting: a unit that must compress is first synthesized
// FASTER natively (TTS speed_ratio, 0.9–nativeMaxSpeed — sounds human); only
// the residual is covered by mechanical retime (≥1). fitClip then rounds the
// timeline duration so the mixer never early-breaks past the buffer (tail
// clipping). Unit failures retry once; the lesson only fails if >10% of units
// are unsynthesizable.

import { Semaphore } from "@/dub/course/engine/semaphore";
import { getSharedAudioContext } from "@/dub/audio-context";
import { synthesizeSegment } from "@/dub/tts";
import {
	autoFitSpeed,
	estimateDuration,
	fitClip,
	MIN_NATURAL_RATE,
} from "@/dub/timing";
import { packDubUnits, type DubUnit } from "@/dub/units";
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
	const units = packDubUnits({ segments, settings });
	if (units.length === 0) {
		throw new Error("没有可配音的句子（请先翻译）");
	}

	const sem = new Semaphore(TTS_CONCURRENCY);
	const audioCtx = getSharedAudioContext();
	const clips: SynthesizedClip[] = [];
	const failures: string[] = [];
	let done = 0;

	const synthOne = async (unit: DubUnit): Promise<void> => {
		// Stage 1 — native TTS speed over the unit's whole span.
		const estimated = estimateDuration({ text: unit.text });
		const nativeRatio =
			unit.manualRate !== undefined || !settings.speedAdaptive || unit.span <= 0
				? 1
				: Math.min(
						Math.max(estimated / unit.span, MIN_NATURAL_RATE),
						Math.max(1, settings.nativeMaxSpeed),
					);

		const attempt = () =>
			synthesizeSegment({
				text: unit.text,
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
					`${unit.id}: ${error instanceof Error ? error.message : "TTS 失败"}`,
				);
				return;
			}
		}

		let realDuration = unit.span;
		try {
			const decoded = await audioCtx.decodeAudioData(bytes.slice(0));
			if (decoded.duration > 0) realDuration = decoded.duration;
		} catch {
			// fall back to the span if the mp3 fails to decode
		}

		// Stage 2 — mechanical retime covers residual COMPRESSION only.
		const residualCap = Math.max(1, settings.maxSpeedup / nativeRatio);
		const retime =
			unit.manualRate !== undefined
				? Math.max(unit.manualRate, 1)
				: Math.max(
						1,
						autoFitSpeed({
							originalDuration: realDuration,
							targetDuration: unit.span,
							maxSpeedup: residualCap,
						}),
					);
		const { fitted, rate } = fitClip({ realDuration, retime });
		clips.push({
			segIds: unit.segIds,
			start: unit.start,
			span: unit.span,
			bytes,
			realDuration,
			rate,
			totalSpeedup: Number((nativeRatio * rate).toFixed(3)),
			fitted,
		});
		done++;
		onStep?.({
			step: `合成配音 ${done}/${units.length} 段`,
			pct: Math.round((done / units.length) * 100),
		});
	};

	await Promise.all(
		units.map((unit) => sem.withPermit(() => synthOne(unit), signal)),
	);

	if (failures.length > units.length * 0.1) {
		throw new Error(
			`TTS 失败过多（${failures.length}/${units.length}）：${failures[0]}`,
		);
	}

	// keep timeline order deterministic regardless of completion order
	clips.sort((a, b) => a.start - b.start);
	return clips;
}
