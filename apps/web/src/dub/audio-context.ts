// Shared AudioContext for all dub decode work. Browsers cap live AudioContexts
// at ~6 — creating one per lesson/apply exhausted the cap by lesson 7 and made
// every later decodeAudioData fail silently (review CRIT-2 / finding #1).
// One module-level instance, recreated only if something closed it.

let shared: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
	if (!shared || shared.state === "closed") {
		const Ctor =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		shared = new Ctor();
	}
	return shared;
}
