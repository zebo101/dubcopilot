"use client";

import { AUTO_LANG, LANGUAGES } from "@/dub/languages";
import { cn } from "@/utils/ui";

/** Compact language dropdown — shared by the dub setup view and the batch
 * center's 统一配置 row. */
export function LangSelect({
	value,
	onChange,
	includeAuto = false,
	disabled = false,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	includeAuto?: boolean;
	disabled?: boolean;
	className?: string;
}) {
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
			{LANGUAGES.map((l) => (
				<option key={l.code} value={l.code}>
					{l.label}
				</option>
			))}
		</select>
	);
}
