import { useDubCredentials, hasTtsKey } from "@/dub/credentials";
import { synthesizeSegment } from "@/dub/tts";

/**
 * Real single-line preview: synthesize the Chinese text via豆包 TTS and play it.
 * No-ops (returns false) if there's no text or no TTS key configured.
 */
export async function previewLine({
	text,
	voiceType,
}: {
	text: string;
	voiceType: string;
}): Promise<boolean> {
	const creds = useDubCredentials.getState();
	if (!text.trim() || !hasTtsKey(creds)) return false;
	const bytes = await synthesizeSegment({ text, voiceType, creds });
	const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
	const audio = new Audio(url);
	audio.onended = () => URL.revokeObjectURL(url);
	try {
		await audio.play();
	} catch {
		// play() can reject (autoplay policy etc.) — don't leak the blob URL
		URL.revokeObjectURL(url);
		return false;
	}
	return true;
}
