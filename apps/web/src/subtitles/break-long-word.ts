// Break a single unbreakable "word" (CJK text has no spaces) into lines that
// fit maxWidth, grapheme by grapheme (greedy fill). Pure — measure is injected
// so the canvas-backed caller and unit tests share the same logic.
export function breakLongWord({
	word,
	maxWidth,
	measure,
}: {
	word: string;
	maxWidth: number;
	measure: (text: string) => number;
}): string[] {
	const graphemes = splitGraphemes({ text: word });
	const lines: string[] = [];
	let current = "";
	for (const g of graphemes) {
		const next = current + g;
		// a line always accepts at least one grapheme — even one wider than
		// maxWidth still emits (mild overflow beats an infinite loop)
		if (current && measure(next) > maxWidth) {
			lines.push(current);
			current = g;
		} else {
			current = next;
		}
	}
	if (current) lines.push(current);
	return lines.length > 0 ? lines : [word];
}

function splitGraphemes({ text }: { text: string }): string[] {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
		return [...seg.segment(text)].map((s) => s.segment);
	}
	return Array.from(text); // code points — safe fallback for surrogate pairs
}
