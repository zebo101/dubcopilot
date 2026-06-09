"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AiVoiceIcon,
	ArrowRight01Icon,
	PlayIcon,
	Loading03Icon,
	Tick02Icon,
	Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { useEditor } from "@/editor/use-editor";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import { useDubStore } from "@/dub/store";
import { applyDubToTimeline } from "@/dub/adapter";
import { VOICES, voiceById, PIPELINE_STAGES } from "@/dub/data";
import { isOverflow, isSped } from "@/dub/timing";
import type { Segment } from "@/dub/types";

function fmtShort({ seconds }: { seconds: number }): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

function SetupView() {
	const settings = useDubStore((s) => s.settings);
	const setSetting = useDubStore((s) => s.setSetting);
	const startGenerate = useDubStore((s) => s.startGenerate);
	const segCount = useDubStore((s) => s.segments.length);

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 space-y-5 overflow-y-auto p-4">
				{/* detected → target */}
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs font-medium">
						翻译方向
					</div>
					<div className="flex items-center gap-2">
						<span className="bg-muted rounded-md px-2.5 py-1.5 text-sm">
							English（检测）
						</span>
						<HugeiconsIcon
							icon={ArrowRight01Icon}
							className="text-muted-foreground size-4"
						/>
						<span className="bg-primary/15 text-primary rounded-md px-2.5 py-1.5 text-sm font-medium">
							中文（简体）
						</span>
					</div>
				</div>

				{/* voice gallery */}
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs font-medium">
						配音音色
					</div>
					<div className="grid grid-cols-2 gap-2">
						{VOICES.map((v) => {
							const selected = settings.voiceId === v.id;
							return (
								<button
									type="button"
									key={v.id}
									onClick={() =>
										setSetting({ key: "voiceId", value: v.id })
									}
									className={cn(
										"flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors",
										selected
											? "border-primary bg-primary/10"
											: "border-border hover:bg-muted",
									)}
								>
									<div className="flex w-full items-center gap-2">
										<span
											className="flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white"
											style={{
												background: `oklch(0.55 0.13 ${v.hue})`,
											}}
										>
											{v.name[0]}
										</span>
										<span className="text-sm font-medium">{v.name}</span>
										{v.recommended ? (
											<span className="bg-primary/20 text-primary ml-auto rounded px-1 text-[10px]">
												推荐
											</span>
										) : null}
									</div>
									<span className="text-muted-foreground text-[11px]">
										{v.genderLabel} · {v.style}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* original audio */}
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs font-medium">
						原声处理
					</div>
					<div className="bg-muted inline-flex rounded-md p-0.5">
						{(["mute", "background"] as const).map((mode) => (
							<button
								type="button"
								key={mode}
								onClick={() =>
									setSetting({ key: "originalAudio", value: mode })
								}
								className={cn(
									"rounded px-3 py-1 text-xs transition-colors",
									settings.originalAudio === mode
										? "bg-background shadow-sm"
										: "text-muted-foreground",
								)}
							>
								{mode === "mute" ? "静音原声" : "保留为背景"}
							</button>
						))}
					</div>
				</div>

				{/* subtitles */}
				<label className="flex cursor-pointer items-center justify-between">
					<span className="text-sm">同时生成中文字幕</span>
					<input
						type="checkbox"
						checked={settings.subtitles}
						onChange={(e) =>
							setSetting({ key: "subtitles", value: e.target.checked })
						}
					/>
				</label>
			</div>

			<div className="border-t p-3">
				<Button className="w-full" onClick={() => startGenerate()}>
					<HugeiconsIcon icon={AiVoiceIcon} className="size-4" />
					生成配音
				</Button>
				<div className="text-muted-foreground mt-2 text-center text-xs">
					{segCount} 句 · 预计 1–2 分钟
				</div>
			</div>
		</div>
	);
}

function ProcessingView() {
	const procStage = useDubStore((s) => s.procStage);
	const procPct = useDubStore((s) => s.procPct);
	const cancelGenerate = useDubStore((s) => s.cancelGenerate);

	return (
		<div className="flex h-full flex-col p-4">
			<div className="text-sm font-medium">正在生成配音…</div>
			<div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
				<div
					className="bg-primary h-full transition-[width]"
					style={{ width: `${procPct}%` }}
				/>
			</div>
			<div className="mt-4 space-y-2">
				{PIPELINE_STAGES.map((stage, i) => {
					const done = i < procStage;
					const active = i === procStage;
					return (
						<div key={stage.id} className="flex items-center gap-2">
							<span
								className={cn(
									"flex size-5 items-center justify-center rounded-full text-[10px]",
									done && "bg-primary/20 text-primary",
									active && "bg-primary text-primary-foreground",
									!done && !active && "bg-muted text-muted-foreground",
								)}
							>
								{done ? (
									<HugeiconsIcon icon={Tick02Icon} className="size-3" />
								) : active ? (
									<HugeiconsIcon
										icon={Loading03Icon}
										className="size-3 animate-spin"
									/>
								) : (
									i + 1
								)}
							</span>
							<div className="flex flex-col">
								<span className="text-xs">{stage.label}</span>
								<span className="text-muted-foreground text-[10px]">
									{stage.detail}
								</span>
							</div>
						</div>
					);
				})}
			</div>
			<Button
				variant="outline"
				className="mt-auto"
				onClick={() => cancelGenerate()}
			>
				<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
				取消
			</Button>
		</div>
	);
}

function SegmentRow({ seg, active }: { seg: Segment; active: boolean }) {
	const editor = useEditor();
	const selectedSegId = useDubStore((s) => s.selectedSegId);
	const selectSegment = useDubStore((s) => s.selectSegment);
	const editSegment = useDubStore((s) => s.editSegment);
	const selected = selectedSegId === seg.id;
	const overflow = isOverflow({ timing: seg.timing });
	const sped = isSped({ timing: seg.timing });
	const [editing, setEditing] = useState(false);

	const selectAndSeek = () => {
		selectSegment({ id: seg.id });
		editor.playback.seek({
			time: mediaTimeFromSeconds({ seconds: seg.start }),
		});
	};

	const commit = (text: string) => {
		setEditing(false);
		const next = text.trim();
		if (next && next !== seg.translated) {
			editSegment({ id: seg.id, text: next });
		}
	};

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={selectAndSeek}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") selectAndSeek();
			}}
			className={cn(
				"flex w-full cursor-pointer gap-2 rounded-md border-l-2 px-2.5 py-2 text-left transition-colors",
				selected
					? "border-l-primary bg-primary/10"
					: active
						? "border-l-primary/40 bg-primary/5"
						: "border-l-transparent hover:bg-muted",
			)}
		>
			<span className="text-muted-foreground w-9 shrink-0 pt-0.5 text-[11px] tabular-nums">
				{fmtShort({ seconds: seg.start })}
			</span>
			<div className="min-w-0 flex-1">
				<div className="text-muted-foreground truncate text-[11px]">
					{seg.source}
				</div>
				{editing ? (
					<textarea
						autoFocus
						defaultValue={seg.translated}
						rows={2}
						onClick={(e) => e.stopPropagation()}
						onBlur={(e) => commit(e.target.value)}
						onKeyDown={(e) => {
							e.stopPropagation();
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								commit((e.target as HTMLTextAreaElement).value);
							} else if (e.key === "Escape") {
								setEditing(false);
							}
						}}
						className="border-border bg-background mt-0.5 w-full resize-none rounded border p-1 text-sm"
					/>
				) : (
					<div
						className="text-sm"
						title="双击编辑译文"
						onDoubleClick={(e) => {
							e.stopPropagation();
							setEditing(true);
						}}
					>
						{seg.translated}
					</div>
				)}
			</div>
			<div className="shrink-0 pt-0.5">
				{overflow ? (
					<span className="rounded bg-red-500/15 px-1 text-[10px] text-red-500">
						! ×{seg.timing.appliedSpeedup.toFixed(2)}
					</span>
				) : sped ? (
					<span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-500">
						×{seg.timing.appliedSpeedup.toFixed(2)}
					</span>
				) : seg.status === "edited" ? (
					<span className="text-primary text-[10px]">已改</span>
				) : null}
			</div>
		</div>
	);
}

function ReviewView() {
	const editor = useEditor();
	const segments = useDubStore((s) => s.segments);
	const settings = useDubStore((s) => s.settings);
	const backToSetup = useDubStore((s) => s.backToSetup);
	const spedCount = segments.filter((s) => isSped({ timing: s.timing })).length;
	const [applying, setApplying] = useState(false);

	// Follow the playhead — highlight whichever line is currently playing.
	const currentSeconds = useEditor((e) =>
		mediaTimeToSeconds({ time: e.playback.getCurrentTime() }),
	);
	const activeId =
		segments.find(
			(s) => currentSeconds >= s.start && currentSeconds < s.end,
		)?.id ?? null;

	const onApply = async () => {
		setApplying(true);
		try {
			await applyDubToTimeline({ editor, segments, settings });
			toast.success("已应用配音到时间轴");
		} catch (error) {
			console.error("applyDubToTimeline failed", error);
			toast.error("应用配音失败，请查看控制台");
		} finally {
			setApplying(false);
		}
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-3 border-b px-4 py-2 text-xs">
				<span>
					<b>{segments.length}</b> 句
				</span>
				<span className={cn(spedCount > 0 && "text-amber-500")}>
					<b>{spedCount}</b> 已加速
				</span>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground ml-auto"
					onClick={() => backToSetup()}
				>
					重新设置
				</button>
			</div>
			<div className="flex-1 space-y-0.5 overflow-y-auto p-2">
				{segments.map((seg) => (
					<SegmentRow key={seg.id} seg={seg} active={activeId === seg.id} />
				))}
			</div>
			<div className="border-t p-3">
				<Button
					className="w-full"
					disabled={applying}
					onClick={() => onApply()}
				>
					<HugeiconsIcon icon={PlayIcon} className="size-4" />
					{applying ? "正在应用…" : "应用到时间轴"}
				</Button>
			</div>
		</div>
	);
}

export function DubView() {
	const phase = useDubStore((s) => s.phase);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b px-4 py-2.5">
				<HugeiconsIcon icon={AiVoiceIcon} className="text-primary size-4" />
				<span className="text-sm font-semibold">AI 配音</span>
				<span className="bg-primary/15 text-primary rounded px-1.5 text-[10px]">
					BETA
				</span>
			</div>
			<div className="min-h-0 flex-1">
				{phase === "processing" ? (
					<ProcessingView />
				) : phase === "review" ? (
					<ReviewView />
				) : (
					<SetupView />
				)}
			</div>
		</div>
	);
}
