// Dub subtitle legibility style — the industry-standard answer to "white text
// on a white background is invisible": a semi-transparent dark box behind
// white text (YouTube CC default look). Unlike adaptive color sampling, this
// reads on ANY background, costs nothing, and never flickers between frames.

import type { SubtitleStyleOverrides } from "@/subtitles/types";

export const DUB_SUBTITLE_STYLE: SubtitleStyleOverrides = {
	color: "#ffffff",
	background: {
		enabled: true,
		// canvas fillStyle accepts rgba — 55% black survives bright UI footage
		color: "rgba(0, 0, 0, 0.55)",
		cornerRadius: 10,
		paddingX: 22,
		paddingY: 12,
	},
};
