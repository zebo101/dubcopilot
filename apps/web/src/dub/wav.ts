/**
 * Encode mono Float32 PCM samples into a 16-bit WAV Blob — no dependencies.
 *
 * We feed cloud transcription the SAME 16 kHz mono samples the local path
 * already decodes, so a 7-minute clip is ~13 MB (416s × 16000 × 2 bytes)
 * instead of the ~73 MB raw timeline mixdown — comfortably under Groq's upload
 * limit and far quicker to send.
 */
export function encodeWavFromFloat32({
	samples,
	sampleRate,
}: {
	samples: Float32Array;
	sampleRate: number;
}): Blob {
	const numFrames = samples.length;
	const bytesPerSample = 2; // 16-bit
	const blockAlign = bytesPerSample; // mono
	const byteRate = sampleRate * blockAlign;
	const dataSize = numFrames * bytesPerSample;

	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	const writeStr = (offset: number, s: string) => {
		for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
	};

	writeStr(0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeStr(8, "WAVE");
	writeStr(12, "fmt ");
	view.setUint32(16, 16, true); // PCM fmt chunk size
	view.setUint16(20, 1, true); // audio format = PCM
	view.setUint16(22, 1, true); // channels = mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true); // bits per sample
	writeStr(36, "data");
	view.setUint32(40, dataSize, true);

	let offset = 44;
	for (let i = 0; i < numFrames; i++) {
		const clamped = Math.max(-1, Math.min(1, samples[i]));
		view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
		offset += 2;
	}

	return new Blob([buffer], { type: "audio/wav" });
}
