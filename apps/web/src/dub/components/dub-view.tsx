"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AiVoiceIcon,
	ArrowRight01Icon,
	PlayIcon,
	Loading03Icon,
	Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { useEditor } from "@/editor/use-editor";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import { useDubStore } from "@/dub/store";
import { useDubCredentials, hasTtsKey } from "@/dub/credentials";
import { applyDubToTimeline } from "@/dub/adapter";
import { generateDubSegments } from "@/dub/generate";
import { translateSegments } from "@/dub/translate";
import { VOICES } from "@/dub/data";
import { isOverflow, isSped } from "@/dub/timing";
import type { Segment } from "@/dub/types";

function fmtShort({ seconds }: { seconds: number }): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

function CredField({
	label,
	value,
	onChange,
	type = "text",
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: "text" | "password";
	placeholder?: string;
}) {
	return (
		<label className="block space-y-1">
			<span className="text-muted-foreground text-[11px]">{label}</span>
			<input
				type={type}
				value={value}
				placeholder={placeholder}
				spellCheck={false}
				autoComplete="off"
				onChange={(e) => onChange(e.target.value)}
				className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
			/>
		</label>
	);
}

function CredentialsSection() {
	const cred = useDubCredentials();
	const [open, setOpen] = useState(false);
	const configured = hasTtsKey(cred);

	return (
		<div className="rounded-md border">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
			>
				<span className="font-medium">语音 / 翻译 凭据</span>
				<span
					className={cn(
						"rounded px-1.5 text-[10px]",
						configured
							? "bg-emerald-500/15 text-emerald-500"
							: "bg-amber-500/15 text-amber-500",
					)}
				>
					{configured ? "已配置" : "未配置"}
				</span>
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					className={cn(
						"text-muted-foreground ml-auto size-4 transition-transform",
						open && "rotate-90",
					)}
				/>
			</button>
			{open ? (
				<div className="space-y-3 border-t p-3">
					<div className="space-y-2">
						<div className="text-[11px] font-medium">豆包语音 TTS</div>
						<CredField
							label="API Key（必填）"
							type="password"
							placeholder="VOLCENGINE_TTS_API_KEY"
							value={cred.ttsApiKey}
							onChange={(v) => cred.setField({ key: "ttsApiKey", value: v })}
						/>
						<CredField
							label="Resource ID"
							value={cred.ttsResourceId}
							onChange={(v) =>
								cred.setField({ key: "ttsResourceId", value: v })
							}
						/>
						<CredField
							label="TTS URL"
							value={cred.ttsUrl}
							onChange={(v) => cred.setField({ key: "ttsUrl", value: v })}
						/>
						<CredField
							label="Cluster"
							value={cred.ttsCluster}
							onChange={(v) => cred.setField({ key: "ttsCluster", value: v })}
						/>
					</div>
					<div className="space-y-2">
						<div className="text-[11px] font-medium">DeepSeek 翻译</div>
						<CredField
							label="API Key（必填）"
							type="password"
							placeholder="sk-..."
							value={cred.deepseekApiKey}
							onChange={(v) =>
								cred.setField({ key: "deepseekApiKey", value: v })
							}
						/>
						<CredField
							label="Base URL"
							value={cred.deepseekBaseUrl}
							onChange={(v) =>
								cred.setField({ key: "deepseekBaseUrl", value: v })
							}
						/>
						<CredField
							label="模型（V4 默认 deepseek-chat）"
							value={cred.deepseekModel}
							onChange={(v) =>
								cred.setField({ key: "deepseekModel", value: v })
							}
						/>
					</div>
					<div className="flex items-center gap-2 pt-1">
						<Button
							size="sm"
							className="h-7 text-xs"
							onClick={() =>
								toast.success("凭据已保存到本地浏览器，刷新不会丢失")
							}
						>
							保存
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs"
							onClick={() => {
								cred.reset();
								toast("已清除凭据");
							}}
						>
							清除
						</Button>
						<span className="text-muted-foreground text-[10px]">
							输入即自动保存
						</span>
					</div>
					<p className="text-muted-foreground text-[10px] leading-relaxed">
						凭据仅存本地浏览器（localStorage），不上传服务器、刷新不丢；仅用于经薄代理调用你自己的 DeepSeek / 豆包接口。
					</p>
				</div>
			) : null}
		</div>
	);
}

function SetupView() {
	const editor = useEditor();
	const settings = useDubStore((s) => s.settings);
	const setSetting = useDubStore((s) => s.setSetting);
	const setPhase = useDubStore((s) => s.setPhase);
	const setProc = useDubStore((s) => s.setProc);
	const setSegments = useDubStore((s) => s.setSegments);
	const applyTranslations = useDubStore((s) => s.applyTranslations);
	const translateConfigured = useDubCredentials(
		(c) => c.deepseekApiKey.trim().length > 0,
	);

	const onGenerate = async () => {
		setPhase("processing");
		setProc({ step: "准备中…", pct: 0 });
		try {
			const segs = await generateDubSegments({
				editor,
				onStep: (a) => setProc(a),
			});
			if (segs.length === 0) {
				toast.error("时间轴没有可转写的音频，请先导入带声音的视频");
				setPhase("setup");
				return;
			}
			setSegments(segs);

			// Real translation via DeepSeek (if configured).
			const creds = useDubCredentials.getState();
			if (creds.deepseekApiKey.trim()) {
				setProc({ step: "DeepSeek 翻译中…", pct: 0 });
				try {
					const map = await translateSegments({
						segments: segs,
						creds,
						onStep: (a) => setProc(a),
					});
					applyTranslations({ map });
				} catch (error) {
					console.error("translate failed", error);
					toast.error(
						error instanceof Error
							? error.message
							: "翻译失败，可在逐句台手动编辑或重试",
					);
				}
			}
			setPhase("review");
		} catch (error) {
			console.error("dub transcription failed", error);
			toast.error(error instanceof Error ? error.message : "转写失败");
			setPhase("setup");
		}
	};

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

				{/* TTS / translation credentials (filled by the user, not hardcoded) */}
				<CredentialsSection />
			</div>

			<div className="border-t p-3">
				{!translateConfigured ? (
					<div className="mb-2 rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-500">
						未配置 DeepSeek Key —— 将只转写原文、不自动翻译（可在逐句台手动编辑）。展开上方「语音 / 翻译 凭据」填写。
					</div>
				) : null}
				<Button className="w-full" onClick={() => onGenerate()}>
					<HugeiconsIcon icon={AiVoiceIcon} className="size-4" />
					生成配音
				</Button>
				<div className="text-muted-foreground mt-2 text-center text-xs">
					转写当前时间轴音频 → 逐句翻译配音
				</div>
			</div>
		</div>
	);
}

function ProcessingView() {
	const procStep = useDubStore((s) => s.procStep);
	const procPct = useDubStore((s) => s.procPct);
	const setPhase = useDubStore((s) => s.setPhase);

	return (
		<div className="flex h-full flex-col p-4">
			<div className="flex items-center gap-2 text-sm font-medium">
				<HugeiconsIcon
					icon={Loading03Icon}
					className="text-primary size-4 animate-spin"
				/>
				正在生成配音…
			</div>
			<div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
				<div
					className="bg-primary h-full transition-[width]"
					style={{ width: `${procPct}%` }}
				/>
			</div>
			<div className="text-muted-foreground mt-2 flex justify-between text-xs">
				<span>{procStep || "处理中…"}</span>
				<span>{Math.round(procPct)}%</span>
			</div>
			<p className="text-muted-foreground mt-4 text-[11px] leading-relaxed">
				正在用浏览器内的语音识别转写当前时间轴音频（首次会下载模型，可能需要一会儿）。识别完成后进入逐句编辑台。
			</p>
			<Button
				variant="outline"
				className="mt-auto"
				onClick={() => setPhase("setup")}
			>
				<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
				返回
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
						{seg.translated || (
							<span className="text-muted-foreground italic">
								（待翻译，双击编辑）
							</span>
						)}
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
	const applyTranslations = useDubStore((s) => s.applyTranslations);
	const spedCount = segments.filter((s) => isSped({ timing: s.timing })).length;
	const [applying, setApplying] = useState(false);
	const [applyStep, setApplyStep] = useState("");
	const [translating, setTranslating] = useState(false);

	const onTranslate = async () => {
		const creds = useDubCredentials.getState();
		if (!creds.deepseekApiKey.trim()) {
			toast.error("请先在 setup 的「语音 / 翻译 凭据」填写 DeepSeek Key");
			return;
		}
		setTranslating(true);
		try {
			const map = await translateSegments({ segments, creds });
			applyTranslations({ map });
			toast.success("DeepSeek 翻译完成");
		} catch (error) {
			console.error("translate failed", error);
			toast.error(error instanceof Error ? error.message : "翻译失败");
		} finally {
			setTranslating(false);
		}
	};

	// Follow the playhead — highlight whichever line is currently playing.
	const currentSeconds = useEditor((e) =>
		mediaTimeToSeconds({ time: e.playback.getCurrentTime() }),
	);
	const activeId =
		segments.find(
			(s) => currentSeconds >= s.start && currentSeconds < s.end,
		)?.id ?? null;

	const onApply = async () => {
		const creds = useDubCredentials.getState();
		setApplying(true);
		setApplyStep("");
		try {
			await applyDubToTimeline({
				editor,
				segments,
				settings,
				creds,
				onStep: ({ step }) => setApplyStep(step),
			});
			toast.success("已应用配音到时间轴");
		} catch (error) {
			console.error("applyDubToTimeline failed", error);
			toast.error(error instanceof Error ? error.message : "应用配音失败");
		} finally {
			setApplying(false);
			setApplyStep("");
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
					className="text-primary hover:text-primary/80 ml-auto disabled:opacity-50"
					onClick={() => onTranslate()}
					disabled={translating}
				>
					{translating ? "翻译中…" : "DeepSeek 翻译"}
				</button>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground"
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
					{applying ? "正在生成配音…" : "生成配音并应用到时间轴"}
				</Button>
				{applying && applyStep ? (
					<div className="text-muted-foreground mt-2 text-center text-xs">
						{applyStep}
					</div>
				) : null}
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
