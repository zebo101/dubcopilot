"use client";

import { AUTO_LANG, LANGUAGES } from "@/dub/languages";
import { cn } from "@/utils/ui";

/** Compact language dropdown — shared by the dub setup view and the batch
 * center's 统一配置 row. */
export function LangSelect({
	value,
	onChange,
	includeAuto = false,
	voiceableOnly = false,
	disabled = false,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	includeAuto?: boolean;
	/** TARGET pickers: only languages 豆包 BigTTS can actually synthesize */
	voiceableOnly?: boolean;
	disabled?: boolean;
	className?: string;
}) {
	const options = voiceableOnly ? LANGUAGES.filter((l) => l.tts) : LANGUAGES;
	// an old session may carry a no-longer-offered value (e.g. "ko") — show it
	// honestly as a disabled entry instead of silently displaying the wrong one
	const stale = !options.some((l) => l.code === value) && value !== AUTO_LANG;
	return (
		<select
			value={value}
			disabled={disabled}
			onChange={(e) => onChange(e.target.value)}
			className={cn(
				"border-border bg-background rounded-md border px-2 py-1.5 text-sm disabled:opacity-50",
				className,
			)}
		>
			{includeAuto ? <option value={AUTO_LANG}>自动检测</option> : null}
			{stale ? (
				<option value={value} disabled>
					{LANGUAGES.find((l) => l.code === value)?.label ?? value}
					（不支持配音，请重选）
				</option>
			) : null}
			{options.map((l) => (
				<option key={l.code} value={l.code}>
					{l.label}
				</option>
			))}
		</select>
	);
}
