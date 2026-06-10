// Map the 原声处理 setting onto the source video track — shared by the
// in-editor adapter and the headless assemble stage (BOTH paths: track mute
// AND per-element background volume).

import type { VideoTrack } from "@/timeline";
import type { DubSettings } from "@/dub/types";

export function applyOriginalAudio({
	main,
	settings,
}: {
	main: VideoTrack;
	settings: DubSettings;
}): VideoTrack {
	if (settings.originalAudio === "mute") {
		return { ...main, muted: true };
	}
	// background: keep audible but duck the volume on every source element.
	return {
		...main,
		muted: false,
		elements: main.elements.map((el) => ({
			...el,
			params: { ...el.params, volume: settings.backgroundVolume },
		})),
	} as VideoTrack;
}
