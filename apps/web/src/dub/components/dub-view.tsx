"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AiVoiceIcon,
	ArrowRight01Icon,
	PlayIcon,
	Loading03Icon,
	Cancel01Icon,
	DashboardSpeed02Icon,
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
import { previewLine } from "@/dub/preview";
import { VOICES } from "@/dub/data";
import { isOverflow, isSped } from "@/dub/timing";
import type { Segment } from "@/dub/types";
import { TRANSCRIPTION_MODELS } from "@/transcription/models";
import type { TranscriptionModelId } from "@/transcription/types";
import { useCourseStore } from "@/dub/course/store";
import { loadDubSession, saveDubSession } from "@/dub/session";
import { useRouter } from "next/navigation";

function fmtShort({ seconds }: { seconds: number }): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
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
	const [advOpen, setAdvOpen] = useState(false);

	const onGenerate = async () => {
		const creds = useDubCredentials.getState();
		if (settings.transcribeProvider === "cloud" && !creds.groqApiKey.trim()) {
			toast.error(
				"云端转写需要 Groq API Key —— 请在「语音 / 翻译 凭据」填写，或切到本地转写",
			);
			return;
		}
		setPhase("processing");
		setProc({ step: "准备中…", pct: 0 });
		try {
			const segs = await generateDubSegments({
				editor,
				provider: settings.transcribeProvider,
				modelId: settings.transcribeModel,
				language: "en",
				creds,
				onStep: (a) => setProc(a),
			});
			if (segs.length === 0) {
				toast.error("时间轴没有可转写的音频，请先导入带声音的视频");
				setPhase("setup");
				return;
			}
			setSegments(segs);

			// Real translation via DeepSeek (if configured).
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

				{/* transcription backend — speed vs privacy */}
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs font-medium">
						转写方式
					</div>
					<div className="bg-muted inline-flex rounded-md p-0.5">
						{(["cloud", "local"] as const).map((mode) => (
							<button
								type="button"
								key={mode}
								onClick={() =>
									setSetting({ key: "transcribeProvider", value: mode })
								}
								className={cn(
									"rounded px-3 py-1 text-xs transition-colors",
									settings.transcribeProvider === mode
										? "bg-background shadow-sm"
										: "text-muted-foreground",
								)}
							>
								{mode === "cloud" ? "云端 Groq（快）" : "本地（免费/慢）"}
							</button>
						))}
					</div>
					{settings.transcribeProvider === "cloud" ? (
						<p className="text-muted-foreground text-[10px] leading-relaxed">
							用你的 Groq Key 在云端跑 whisper-large-v3-turbo，7 分钟视频几秒出结果（音频会上传到 Groq）。在下方「语音 / 翻译 凭据」填 Groq Key。
						</p>
					) : (
						<div className="space-y-2">
							<select
								value={settings.transcribeModel}
								onChange={(e) =>
									setSetting({
										key: "transcribeModel",
										value: e.target.value as TranscriptionModelId,
									})
								}
								className="border-border bg-background w-full rounded-md border px-2.5 py-1.5 text-sm"
							>
								{TRANSCRIPTION_MODELS.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name} — {m.description}
									</option>
								))}
							</select>
							<p className="text-muted-foreground text-[10px] leading-relaxed">
								浏览器本地识别、不上传：有 WebGPU 时约 1–2 分钟，否则走 CPU 会很慢。先用 Tiny 跑通。
							</p>
						</div>
					)}
				</div>

				{/* everything else (voice / original audio / subtitles / speed /
				    credentials) lives in the RIGHT 配音设置 panel — keep this
				    column focused on moving the flow forward. */}
				<div className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-[11px] leading-relaxed">
					音色、原声、字幕、语速与凭据 → 在<b>右侧「配音设置」面板</b>调整，任何阶段都可改。
				</div>
			</div>

			<div className="border-t p-3">
				{!translateConfigured ? (
					<div className="mb-2 rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-500">
						未配置 DeepSeek Key —— 将只识别原文、不自动翻译（可在逐句台手动编辑）。请在右侧「配音设置 → 语音 / 翻译 凭据」填写。
					</div>
				) : null}
				<Button className="w-full" onClick={() => onGenerate()}>
					<HugeiconsIcon icon={AiVoiceIcon} className="size-4" />
					① 识别原文并翻译 →
				</Button>
				<div className="text-muted-foreground mt-2 text-center text-xs">
					识别时间轴音频 → 自动翻译 → 进入逐句复核（先不合成语音）
				</div>
			</div>
		</div>
	);
}

function ProcessingView() {
	const procStep = useDubStore((s) => s.procStep);
	const procPct = useDubStore((s) => s.procPct);
	const setPhase = useDubStore((s) => s.setPhase);
	const [elapsed, setElapsed] = useState(0);

	// Browser Whisper reports no per-chunk progress, so the bar can sit at 95%
	// for minutes during inference. A live elapsed clock proves it's still alive.
	useEffect(() => {
		const started = performance.now();
		const id = setInterval(() => {
			setElapsed(Math.floor((performance.now() - started) / 1000));
		}, 1000);
		return () => clearInterval(id);
	}, []);

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
				<span>
					{Math.round(procPct)}% · {fmtShort({ seconds: elapsed })}
				</span>
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
	const voiceId = useDubStore((s) => s.settings.voiceId);
	const selected = selectedSegId === seg.id;
	const overflow = isOverflow({ timing: seg.timing });
	const sped = isSped({ timing: seg.timing });
	const [editing, setEditing] = useState(false);
	const [previewing, setPreviewing] = useState(false);

	const onPreview = async (e: { stopPropagation: () => void }) => {
		e.stopPropagation();
		if (previewing || !seg.translated.trim()) return;
		setPreviewing(true);
		try {
			await previewLine({ text: seg.translated, voiceType: voiceId });
		} catch (err) {
			console.error("preview failed", err);
		} finally {
			setPreviewing(false);
		}
	};

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
						: !seg.translated.trim()
							? "border-l-red-400/70 hover:bg-muted"
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
					// click the text = edit (discoverable); click elsewhere = seek
					<div
						className="hover:bg-muted/60 -mx-1 cursor-text rounded px-1 text-sm"
						title="点击编辑译文"
						onClick={(e) => {
							e.stopPropagation();
							setEditing(true);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.stopPropagation();
								setEditing(true);
							}
						}}
						role="textbox"
						tabIndex={0}
					>
						{seg.translated || (
							<span className="italic text-red-400">（未译 · 点击填写）</span>
						)}
					</div>
				)}
			</div>
			<div className="flex shrink-0 items-start gap-1 pt-0.5">
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
				<button
					type="button"
					title="试听这一句"
					disabled={previewing || !seg.translated.trim()}
					onClick={onPreview}
					className="hover:bg-muted flex size-6 items-center justify-center rounded disabled:opacity-40"
				>
					<HugeiconsIcon
						icon={previewing ? Loading03Icon : PlayIcon}
						className={cn("size-3", previewing && "animate-spin")}
					/>
				</button>
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
	const editedCount = segments.filter((s) => s.status === "edited").length;
	const untranslatedCount = segments.filter(
		(s) => !s.translated.trim(),
	).length;
	const dubDuration = segments.length
		? Math.max(...segments.map((s) => s.end))
		: 0;
	const [applying, setApplying] = useState(false);
	const [applyStep, setApplyStep] = useState("");
	const [translating, setTranslating] = useState(false);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<
		"all" | "untranslated" | "overflow" | "sped" | "edited"
	>("all");

	const overflowCount = segments.filter((s) =>
		isOverflow({ timing: s.timing }),
	).length;
	const matchesFilter = (s: Segment): boolean => {
		switch (filter) {
			case "untranslated":
				return !s.translated.trim();
			case "overflow":
				return isOverflow({ timing: s.timing });
			case "sped":
				return isSped({ timing: s.timing });
			case "edited":
				return s.status === "edited";
			default:
				return true;
		}
	};
	const filtered = segments.filter(
		(s) =>
			matchesFilter(s) &&
			(!query.trim() ||
				(s.translated + s.source)
					.toLowerCase()
					.includes(query.trim().toLowerCase())),
	);
	// gap separators only make sense on the unfiltered, unsearched list
	const showGaps = filter === "all" && !query.trim();

	// Course hand-back: if this project is a batch lesson, reviewing ends with
	// an explicit ✓ that flips its triage status and returns to /course.
	const router = useRouter();
	const activeProjectId = useEditor(
		(e) => e.project.getActiveOrNull()?.metadata.id ?? null,
	);
	const courseLesson = useCourseStore((s) =>
		activeProjectId
			? s.course?.lessons.find((l) => l.projectId === activeProjectId)
			: undefined,
	);

	const onTranslate = async () => {
		const creds = useDubCredentials.getState();
		if (!creds.deepseekApiKey.trim()) {
			toast.error("请先在 setup 的「语音 / 翻译 凭据」填写 DeepSeek Key");
			return;
		}
		setTranslating(true);
		try {
			// If some lines are still untranslated, fill only those (gap-fill);
			// otherwise re-translate everything (a deliberate redo).
			const missing = segments.filter((s) => !s.translated.trim());
			const targets = missing.length > 0 ? missing : segments;
			const map = await translateSegments({ segments: targets, creds });
			applyTranslations({ map });
			const stillMissing = targets.filter((s) => !map.has(s.id)).length;
			toast.success(
				stillMissing > 0
					? `翻译完成，仍有 ${stillMissing} 句未译（可再点一次补全）`
					: "DeepSeek 翻译完成",
			);
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
		// hard guard: never write one project's lines onto another's timeline
		const activeProj = editor.project.getActiveOrNull()?.metadata.id ?? null;
		if (activeProj && useDubStore.getState().projectId !== activeProj) {
			toast.error("当前句子不属于打开的项目，请等待会话加载后重试");
			return;
		}
		setApplying(true);
		setApplyStep("");
		try {
			const applied = await applyDubToTimeline({
				editor,
				segments,
				settings,
				creds,
				onStep: ({ step }) => setApplyStep(step),
			});
			// sync the review panel to the REAL post-TTS timing (was estimates)
			useDubStore.getState().applyRealTiming({ map: applied });
			// persist the session so reopening this project resumes in review
			const projectId = editor.project.getActiveOrNull()?.metadata.id;
			if (projectId) {
				void saveDubSession({
					projectId,
					segments: useDubStore.getState().segments,
					settings,
				});
				// the previously exported mp4 (if any) is now stale — clear the
				// export marker so 批量中心 shows 未导出 and prompts a re-export
				const courseLesson = useCourseStore
					.getState()
					.course?.lessons.find((l) => l.projectId === projectId);
				if (courseLesson?.exportedAt) {
					useCourseStore.getState().updateLesson({
						id: courseLesson.id,
						patch: { exportedAt: undefined, outputName: undefined },
					});
				}
			}
			toast.success("已应用配音到时间轴");
		} catch (error) {
			console.error("applyDubToTimeline failed", error);
			toast.error(error instanceof Error ? error.message : "应用配音失败");
		} finally {
			setApplying(false);
			setApplyStep("");
		}
	};

	const chips: {
		key: typeof filter;
		label: string;
		count: number;
		tone?: "red" | "amber";
	}[] = [
		{ key: "all", label: "全部", count: segments.length },
		{ key: "untranslated", label: "未译", count: untranslatedCount, tone: "red" },
		{ key: "overflow", label: "超时", count: overflowCount, tone: "red" },
		{ key: "sped", label: "加速", count: spedCount, tone: "amber" },
		{ key: "edited", label: "已改", count: editedCount },
	];

	return (
		<div className="flex h-full flex-col">
			{/* triage chips — click to filter straight to the problem lines */}
			<div className="flex items-center gap-1.5 border-b px-3 py-2 text-xs">
				{chips.map((c) => (
					<button
						type="button"
						key={c.key}
						onClick={() => setFilter(filter === c.key ? "all" : c.key)}
						disabled={c.count === 0 && c.key !== "all"}
						className={cn(
							"flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors disabled:opacity-35",
							filter === c.key
								? "bg-primary/15 text-primary"
								: "text-muted-foreground hover:bg-muted",
						)}
					>
						{c.label}
						<b
							className={cn(
								c.tone === "red" && c.count > 0 && "text-red-500",
								c.tone === "amber" && c.count > 0 && "text-amber-500",
							)}
						>
							{c.count}
						</b>
					</button>
				))}
				<span className="text-muted-foreground ml-auto tabular-nums">
					{fmtShort({ seconds: dubDuration })}
				</span>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground"
					onClick={() => backToSetup()}
				>
					重新设置
				</button>
			</div>
			<div className="flex items-center gap-2 border-b px-3 py-2">
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="搜索译文 / 原文…"
					className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
				/>
				<button
					type="button"
					className="text-primary hover:text-primary/80 shrink-0 text-xs disabled:opacity-50"
					onClick={() => onTranslate()}
					disabled={translating}
				>
					{translating
						? "翻译中…"
						: untranslatedCount > 0
							? `补译 ${untranslatedCount} 句`
							: "重新翻译"}
				</button>
			</div>
			<div className="flex-1 space-y-0.5 overflow-y-auto p-2">
				{filtered.length === 0 ? (
					<div className="text-muted-foreground p-6 text-center text-xs">
						该筛选下没有句子
					</div>
				) : (
					filtered.map((seg, i) => {
						// surface the source's natural silences so the timeline
						// structure is visible (these are NOT missing dub lines)
						const next = filtered[i + 1];
						const gap = showGaps && next ? next.start - seg.end : 0;
						return (
							<div key={seg.id}>
								<SegmentRow seg={seg} active={activeId === seg.id} />
								{gap > 1.2 ? (
									<div className="text-muted-foreground/70 flex items-center gap-2 px-2 py-0.5 text-[10px]">
										<span className="bg-border h-px flex-1" />
										原片静默 {gap.toFixed(1)}s
										{settings.originalAudio === "background"
											? "（背景原声填充）"
											: "（已静音 — 可在右侧改为保留背景）"}
										<span className="bg-border h-px flex-1" />
									</div>
								) : null}
							</div>
						);
					})
				)}
			</div>
			<div className="border-t p-3">
				<Button
					className="w-full"
					disabled={applying}
					onClick={() => onApply()}
				>
					<HugeiconsIcon icon={PlayIcon} className="size-4" />
					{applying ? "正在合成配音…" : "② 合成配音并应用到时间轴"}
				</Button>
				{applying && applyStep ? (
					<div className="text-muted-foreground mt-2 text-center text-xs">
						{applyStep}
					</div>
				) : null}
				{courseLesson ? (
					<Button
						variant="outline"
						className="mt-2 w-full"
						disabled={applying}
						onClick={() => {
							useCourseStore.getState().updateLesson({
								id: courseLesson.id,
								patch: { status: "done" },
							});
							toast.success(`「${courseLesson.title}」已标记复核通过`);
							router.push("/course");
						}}
					>
						✓ 复核通过，返回批量中心
					</Button>
				) : null}
			</div>
		</div>
	);
}

export function DubView() {
	const phase = useDubStore((s) => s.phase);
	const router = useRouter();
	const courseExists = useCourseStore((s) => !!s.course);
	const activeProjectId = useEditor(
		(e) => e.project.getActiveOrNull()?.metadata.id ?? null,
	);

	// Per-project session scoping: the dub store is a singleton, so switching
	// projects MUST drop the previous project's lines (otherwise project A's
	// segments could be applied onto project B's timeline) and then restore
	// the session persisted for the newly active project — batch products land
	// straight in the 逐句编辑台.
	useEffect(() => {
		if (!activeProjectId) return;
		const store = useDubStore.getState();
		if (store.projectId === activeProjectId) return; // same project — keep state
		store.resetForProject({ projectId: activeProjectId });
		void loadDubSession({ projectId: activeProjectId }).then((session) => {
			const s = useDubStore.getState();
			// the user may have switched again while we were loading
			if (s.projectId !== activeProjectId) return;
			if (!session || session.segments.length === 0) return;
			s.setSegments(session.segments);
			for (const [key, value] of Object.entries(session.settings)) {
				s.setSetting({
					key: key as keyof typeof session.settings,
					value: value as never,
				});
			}
			s.setPhase("review");
		});
	}, [activeProjectId]);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b px-4 py-2.5">
				<HugeiconsIcon icon={AiVoiceIcon} className="text-primary size-4" />
				<span className="text-sm font-semibold">AI 配音</span>
				<span className="bg-primary/15 text-primary rounded px-1.5 text-[10px]">
					BETA
				</span>
				<button
					type="button"
					onClick={() => router.push("/course")}
					className="border-border hover:bg-muted ml-auto rounded-md border px-2 py-0.5 text-[11px]"
				>
					{courseExists ? "批量中心 →" : "批量整门课 →"}
				</button>
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
