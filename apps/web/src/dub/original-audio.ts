// Map the 原声处理 setting onto a source video track — shared by the
// in-editor adapter and the headless assemble stage (BOTH paths: track mute
// AND per-element background volume). Source video can live on the MAIN
// track (batch assemble puts it there) or on an OVERLAY video track (a video
// dragged in from the Media panel) — callers must cover both.

import { VOLUME_DB_MIN } from "@/timeline/audio-constants";
import type { VideoTrack } from "@/timeline";
import type { DubSettings } from "@/dub/types";

/**
 * params.volume is in DECIBELS (audio-state.ts dBToLinear), not a 0–1 ratio.
 * Writing the raw 0.12 ratio meant "0.12 dB" ≈ no audible change — the
 * background slider did nothing. 0.12 → ≈ -18.4 dB.
 */
export function linearToDb(linear: number): number {
	if (linear <= 0) return VOLUME_DB_MIN;
	return Math.max(20 * Math.log10(linear), VOLUME_DB_MIN);
}

export function applyOriginalAudio({
	track,
	settings,
}: {
	track: VideoTrack;
	settings: DubSettings;
}): VideoTrack {
	if (settings.originalAudio === "mute") {
		return { ...track, muted: true };
	}
	// background: keep audible but duck the volume on every source element.
	return {
		...track,
		muted: false,
		elements: track.elements.map((el) => ({
			...el,
			params: {
				...el.params,
				volume: linearToDb(settings.backgroundVolume),
			},
		})),
	} as VideoTrack;
}
