"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	PlayIcon,
	Loading03Icon,
	RefreshIcon,
	InformationCircleIcon,
	Tick02Icon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";
import { useDubStore } from "@/dub/store";
import { useDubCredentials, hasTtsKey } from "@/dub/credentials";
import { voiceById } from "@/dub/data";
import { synthesizeSegment } from "@/dub/tts";
import { isOverflow, isSped } from "@/dub/timing";

function fmtClock({ seconds }: { seconds: number }): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	const cs = Math.round((seconds - Math.floor(seconds)) * 100);
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

const PRESETS = [1.0, 1.25, 1.5] as const;

export function DubSegmentInspector() {
	const selectedSegId = useDubStore((s) => s.selectedSegId);
	const seg = useDubStore((s) =>
		s.selectedSegId
			? (s.segments.find((x) => x.id === s.selectedSegId) ?? null)
			: null,
	);
	const settings = useDubStore((s) => s.settings);
	const setSegmentSpeed = useDubStore((s) => s.setSegmentSpeed);
	const resetSegmentSpeed = useDubStore((s) => s.resetSegmentSpeed);
	const [previewing, setPreviewing] = useState(false);

	if (!selectedSegId || !seg) return null;

	const t = seg.timing;
	const speed = t.appliedSpeedup;
	const sped = isSped({ timing: t });
	const overflow = isOverflow({ timing: t });
	const manual = seg.speedMode === "manual";
	const maxSpeed = settings.maxSpeedup;
	const voice = voiceById({ id: settings.voiceId }) ?? null;

	const scaleMax = Math.max(t.originalDuration, t.targetDuration, t.fittedDuration) * 1.08 || 1;
	const targetPct = (t.targetDuration / scaleMax) * 100;
	const fittedPct = (t.fittedDuration / scaleMax) * 100;
	const overBy = t.fittedDuration - t.targetDuration;
	const fillState = overflow ? "danger" : sped ? "warn" : "ok";

	const onPreview = async () => {
		const creds = useDubCredentials.getState();
		if (!seg.translated.trim()) return;
		if (!hasTtsKey(creds)) return;
		setPreviewing(true);
		try {
			const bytes = await synthesizeSegment({
				text: seg.translated,
				voiceType: settings.voiceId,
				creds,
			});
			const url = URL.createObjectURL(
				new Blob([bytes], { type: "audio/mpeg" }),
			);
			const audio = new Audio(url);
			audio.playbackRate = speed;
			audio.onended = () => URL.revokeObjectURL(url);
			await audio.play();
		} catch (error) {
			console.error("preview failed", error);
		} finally {
			setPreviewing(false);
		}
	};

	return (
		<div className="space-y-4 p-3">
			{/* segment text */}
			<div>
				<div className="text-muted-foreground text-[11px]">
					片段 · {fmtClock({ seconds: seg.start })}
				</div>
				<div className="text-muted-foreground mt-1 text-xs">{seg.source}</div>
				<div className="mt-1 text-sm">
					{seg.translated || (
						<span className="text-muted-foreground italic">（待翻译）</span>
					)}
				</div>
			</div>

			{/* voice + preview */}
			<div className="space-y-2">
				<div className="text-muted-foreground text-[11px] font-medium">
					配音音色
				</div>
				<div className="flex items-center gap-2 rounded-md border p-2">
					<span
						className="flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white"
						style={{ background: `oklch(0.55 0.13 ${voice?.hue ?? 255})` }}
					>
						{voice?.name[0] ?? "?"}
					</span>
					<span className="text-sm">{voice?.name ?? "—"}</span>
					<span className="text-muted-foreground ml-auto text-[11px]">
						{voice?.genderLabel} · {voice?.style}
					</span>
				</div>
				<button
					type="button"
					disabled={previewing || !seg.translated.trim()}
					onClick={onPreview}
					className="hover:bg-muted flex w-full items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs disabled:opacity-50"
				>
					<HugeiconsIcon
						icon={previewing ? Loading03Icon : PlayIcon}
						className={cn("size-3.5", previewing && "animate-spin")}
					/>
					{previewing ? "合成中…" : "试听这一句"}
				</button>
			</div>

			{/* speed */}
			<div className="space-y-2">
				<div className="text-muted-foreground text-[11px] font-medium">语速</div>
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"text-lg font-semibold tabular-nums",
							overflow && "text-red-500",
							!overflow && sped && "text-amber-500",
						)}
					>
						×{speed.toFixed(2)}
					</span>
					{manual ? (
						<button
							type="button"
							onClick={() => resetSegmentSpeed({ id: seg.id })}
							className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1 text-[11px]"
						>
							<HugeiconsIcon icon={RefreshIcon} className="size-3" />
							恢复自动
						</button>
					) : (
						<span className="text-primary ml-auto flex items-center gap-1 text-[11px]">
							<HugeiconsIcon icon={SparklesIcon} className="size-3" />
							自动贴合
						</span>
					)}
				</div>

				<input
					type="range"
					min={0.8}
					max={maxSpeed}
					step={0.01}
					value={speed}
					onChange={(e) =>
						setSegmentSpeed({ id: seg.id, rate: Number(e.target.value) })
					}
					className="w-full"
				/>
				<div className="text-muted-foreground flex justify-between text-[10px]">
					<span>慢 0.8×</span>
					<span>原速 1.0×</span>
					<span>快 {maxSpeed.toFixed(1)}×</span>
				</div>

				<div className="flex gap-1">
					<button
						type="button"
						onClick={() => resetSegmentSpeed({ id: seg.id })}
						className={cn(
							"flex-1 rounded border py-1 text-[11px]",
							!manual ? "border-primary bg-primary/10" : "hover:bg-muted",
						)}
					>
						自动
					</button>
					{PRESETS.map((p) => (
						<button
							type="button"
							key={p}
							onClick={() => setSegmentSpeed({ id: seg.id, rate: p })}
							className={cn(
								"flex-1 rounded border py-1 text-[11px]",
								manual && Math.abs(speed - p) < 0.01
									? "border-primary bg-primary/10"
									: "hover:bg-muted",
							)}
						>
							{p === 1 ? "原速" : `${p}×`}
						</button>
					))}
				</div>

				{/* fit meter: dub length vs available slot */}
				<div>
					<div className="bg-muted relative h-2 overflow-hidden rounded">
						<div
							className={cn(
								"h-full",
								fillState === "danger" && "bg-red-500",
								fillState === "warn" && "bg-amber-500",
								fillState === "ok" && "bg-emerald-500",
							)}
							style={{ width: `${Math.min(fittedPct, 100)}%` }}
						/>
						<div
							className="bg-foreground/70 absolute top-0 h-full w-0.5"
							style={{ left: `${targetPct}%` }}
						/>
					</div>
					<div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
						<span>0s</span>
						<span>│ 槽位 {t.targetDuration.toFixed(1)}s</span>
						<span>{scaleMax.toFixed(1)}s</span>
					</div>
				</div>

				{/* hint */}
				{overflow ? (
					<div className="flex gap-1.5 rounded bg-red-500/10 p-2 text-[11px] text-red-600 dark:text-red-400">
						<HugeiconsIcon icon={InformationCircleIcon} className="mt-0.5 size-3.5 shrink-0" />
						<span>
							配音比可用时间长 {overBy.toFixed(2)}s，会盖到下一句。请<b>提高语速</b>或把译文改短。
						</span>
					</div>
				) : sped ? (
					<div className="flex gap-1.5 rounded bg-amber-500/10 p-2 text-[11px] text-amber-600 dark:text-amber-400">
						<HugeiconsIcon icon={InformationCircleIcon} className="mt-0.5 size-3.5 shrink-0" />
						<span>
							为贴合时间已加速 ×{speed.toFixed(2)}。想更自然，可<b>调慢语速</b>、改短译文，或把原声保留为背景。
						</span>
					</div>
				) : (
					<div className="flex gap-1.5 rounded bg-emerald-500/10 p-2 text-[11px] text-emerald-600 dark:text-emerald-400">
						<HugeiconsIcon icon={Tick02Icon} className="mt-0.5 size-3.5 shrink-0" />
						<span>正好贴合时间槽，语速自然。</span>
					</div>
				)}
			</div>

			{/* timing report */}
			<div className="space-y-2">
				<div className="text-muted-foreground text-[11px] font-medium">
					时间对齐报告
				</div>
				<div className="grid grid-cols-2 gap-2">
					<TimingCell k="配音原始时长" v={`${t.originalDuration.toFixed(2)}s`} />
					<TimingCell k="可用时间槽" v={`${t.targetDuration.toFixed(2)}s`} />
					<TimingCell
						k="对齐后时长"
						v={`${t.fittedDuration.toFixed(2)}s`}
						state={overflow ? "danger" : undefined}
					/>
					<TimingCell
						k="应用语速"
						v={`×${speed.toFixed(2)}`}
						state={overflow ? "danger" : sped ? "warn" : undefined}
					/>
				</div>
			</div>
		</div>
	);
}

function TimingCell({
	k,
	v,
	state,
}: {
	k: string;
	v: string;
	state?: "danger" | "warn";
}) {
	return (
		<div className="bg-muted/50 rounded p-2">
			<div className="text-muted-foreground text-[10px]">{k}</div>
			<div
				className={cn(
					"text-sm font-medium tabular-nums",
					state === "danger" && "text-red-500",
					state === "warn" && "text-amber-500",
				)}
			>
				{v}
			</div>
		</div>
	);
}
