"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AiVoiceIcon,
	ArrowRight01Icon,
	Cancel01Icon,
	Delete02Icon,
	InformationCircleIcon,
	Loading03Icon,
	PlayIcon,
	RefreshIcon,
	Search01Icon,
	SparklesIcon,
	Tick02Icon,
	UploadIcon,
	VolumeOffIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import { VOICES } from "@/dub/data";
import { useDubStore } from "@/dub/store";
import { useCourseStore } from "@/dub/course/store";
import { runCourseBatch, stopCourseRun } from "@/dub/course/runner";
import {
	exportCourseToFolder,
	exportCourseToZip,
} from "@/dub/course/export-batch";
import type { CourseLesson, LessonStatus } from "@/dub/course/types";

const STATUS_META: Record<
	LessonStatus,
	{ label: string; cls: string }
> = {
	queued: { label: "排队", cls: "bg-muted text-muted-foreground" },
	processing: { label: "处理中", cls: "bg-primary/15 text-primary" },
	done: { label: "完成", cls: "bg-emerald-500/15 text-emerald-500" },
	review: { label: "需复核", cls: "bg-amber-500/15 text-amber-500" },
	failed: { label: "失败", cls: "bg-red-500/15 text-red-500" },
};

function fmtDur({ sec }: { sec: number }): string {
	const m = Math.floor(sec / 60);
	const s = Math.round(sec % 60);
	return `${m}分${String(s).padStart(2, "0")}秒`;
}

function StatusPill({ lesson }: { lesson: CourseLesson }) {
	const info = STATUS_META[lesson.status];
	return (
		<div className="flex flex-col gap-1">
			<span
				className={cn(
					"inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[11px]",
					info.cls,
				)}
			>
				{lesson.status === "processing" && (
					<HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
				)}
				{info.label}
			</span>
			{lesson.status === "processing" && (
				<div className="bg-muted h-1 w-20 overflow-hidden rounded-full">
					<div
						className="bg-primary h-full transition-[width]"
						style={{ width: `${lesson.progress}%` }}
					/>
				</div>
			)}
		</div>
	);
}

function LessonRow({
	lesson,
	selected,
	onToggle,
	onOpen,
	onRun,
	onApprove,
}: {
	lesson: CourseLesson;
	selected: boolean;
	onToggle: () => void;
	onOpen: () => void;
	onRun: () => void;
	onApprove: () => void;
}) {
	const flagged = (lesson.spedCount ?? 0) > 0 || (lesson.overflowCount ?? 0) > 0;
	return (
		<div
			className={cn(
				"grid grid-cols-[28px_44px_1fr_120px_110px_1fr_92px] items-center gap-2 border-b px-3 py-2 text-xs",
				selected && "bg-primary/5",
			)}
		>
			<input
				type="checkbox"
				checked={selected}
				onChange={onToggle}
				onClick={(e) => e.stopPropagation()}
			/>
			<span className="text-muted-foreground tabular-nums">
				{String(lesson.index).padStart(3, "0")}
			</span>
			<button type="button" className="min-w-0 text-left" onClick={onOpen}>
				<div className="truncate font-medium">{lesson.title}</div>
				<div className="text-muted-foreground truncate text-[10px]">
					{lesson.chapter}
					{lesson.segCount ? ` · ${lesson.segCount} 句` : ""}
					{lesson.subtitleLang === "zh"
						? " · 中文字幕·直配"
						: lesson.subtitleLang === "en"
							? " · 英文字幕·翻译"
							: " · 需转写"}
				</div>
			</button>
			<div className="text-muted-foreground flex items-center gap-1">
				<span>EN</span>
				<HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
				<span className="text-foreground">中</span>
			</div>
			<StatusPill lesson={lesson} />
			<div className="flex flex-wrap gap-1">
				{lesson.status === "failed" ? (
					<span className="rounded bg-red-500/15 px-1 text-[10px] text-red-500">
						{lesson.failReason ?? "失败"}
					</span>
				) : (
					<>
						{(lesson.overflowCount ?? 0) > 0 && (
							<span className="rounded bg-red-500/15 px-1 text-[10px] text-red-500">
								! {lesson.overflowCount} 超时
							</span>
						)}
						{(lesson.spedCount ?? 0) > 0 && (
							<span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-500">
								⚡ {lesson.spedCount} 加速
							</span>
						)}
						{!flagged && lesson.status === "done" && (
							<span className="text-muted-foreground text-[10px]">无需改</span>
						)}
						{(lesson.status === "done" || lesson.status === "review") &&
							lesson.projectId &&
							!lesson.exportedAt && (
								<span className="bg-muted text-muted-foreground rounded px-1 text-[10px]">
									未导出
								</span>
							)}
					</>
				)}
			</div>
			<div className="flex justify-end gap-1">
				{lesson.status === "failed" || lesson.status === "queued" ? (
					<Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRun}>
						<HugeiconsIcon
							icon={lesson.status === "failed" ? RefreshIcon : PlayIcon}
							className="size-3"
						/>
						{lesson.status === "failed" ? "重试" : "生成"}
					</Button>
				) : (
					<>
						{lesson.status === "review" && (
							<Button
								size="sm"
								variant="outline"
								className="h-7 text-xs text-emerald-600"
								onClick={onApprove}
								title="不打开直接确认复核通过"
							>
								✓ 通过
							</Button>
						)}
						<Button
							size="sm"
							variant={lesson.status === "review" ? "default" : "outline"}
							className="h-7 text-xs"
							onClick={onOpen}
							disabled={!lesson.projectId}
						>
							打开
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

const TABS: [LessonStatus | "all", string][] = [
	["all", "全部"],
	["queued", "排队"],
	["processing", "处理中"],
	["review", "需复核"],
	["failed", "失败"],
	["done", "完成"],
];

export function BatchCenter() {
	const router = useRouter();
	const course = useCourseStore((s) => s.course);
	const selection = useCourseStore((s) => s.selection);
	const batchRunning = useCourseStore((s) => s.batchRunning);
	const paused = useCourseStore((s) => s.paused);
	const autoExport = useCourseStore((s) => s.autoExport);
	const needsPermission = useCourseStore((s) => s.needsPermission);
	const exporting = useCourseStore((s) => s.exporting);
	const exportDone = useCourseStore((s) => s.exportDone);
	const exportTotal = useCourseStore((s) => s.exportTotal);
	const exportCurrent = useCourseStore((s) => s.exportCurrent);
	const settings = useDubStore((s) => s.settings);
	const setSetting = useDubStore((s) => s.setSetting);

	const runExport = async (kind: "folder" | "zip", onlyIds?: string[]) => {
		const setExport = useCourseStore.getState().setExport;
		setExport({ exporting: true, done: 0, total: 0, current: "" });
		try {
			const fn = kind === "zip" ? exportCourseToZip : exportCourseToFolder;
			const res = await fn({
				onlyIds,
				onProgress: (p) =>
					setExport({ done: p.done, total: p.total, current: p.current }),
			});
			toast.success(`已导出 ${res.written} 节`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "导出失败");
		} finally {
			setExport({ exporting: false });
		}
	};

	const [filter, setFilter] = useState<LessonStatus | "all">("review");
	const [query, setQuery] = useState("");

	const lessons = course?.lessons ?? [];
	const counts = useMemo(() => {
		const c = { all: lessons.length, queued: 0, processing: 0, done: 0, review: 0, failed: 0 };
		for (const l of lessons) c[l.status]++;
		return c;
	}, [lessons]);

	const overallPct = lessons.length
		? Math.round(
				(lessons.reduce(
					(a, l) =>
						a +
						(l.status === "queued" || l.status === "failed"
							? 0
							: l.status === "processing"
								? l.progress
								: 100),
					0,
				) /
					(lessons.length * 100)) *
					100,
			)
		: 0;

	const filtered = useMemo(() => {
		let rows = lessons.filter((l) => (filter === "all" ? true : l.status === filter));
		if (query.trim()) {
			const q = query.toLowerCase();
			rows = rows.filter((l) =>
				(l.title + l.chapter + l.stem).toLowerCase().includes(q),
			);
		}
		return rows;
	}, [lessons, filter, query]);

	const voiceIdx = Math.max(0, VOICES.findIndex((v) => v.id === settings.voiceId));
	const voice = VOICES[voiceIdx] ?? VOICES[0];

	const allSelected = filtered.length > 0 && filtered.every((l) => selection.includes(l.id));
	const toggleAll = () => {
		const s = useCourseStore.getState();
		allSelected ? s.clearSelection() : s.selectMany({ ids: filtered.map((l) => l.id) });
	};

	// Review hand-off: stage the zero-copy video for in-memory injection, then
	// open the lesson's project in the editor.
	const openLesson = async (lesson: CourseLesson) => {
		if (!lesson.projectId || !lesson.videoMediaId) return;
		const s = useCourseStore.getState();
		const handle = s.videoHandles[lesson.id];
		if (!handle) {
			toast.error("找不到视频文件，请先恢复文件夹授权");
			return;
		}
		try {
			const file = await handle.getFile();
			s.setPendingInjection({
				injection: {
					projectId: lesson.projectId,
					mediaId: lesson.videoMediaId,
					file,
				},
			});
			router.push(`/editor/${lesson.projectId}`);
		} catch {
			toast.error("读取视频失败，请恢复文件夹授权后重试");
		}
	};

	if (!course) return null;

	return (
		<div className="bg-background flex h-screen w-screen flex-col">
			{/* header */}
			<header className="flex items-center gap-4 border-b px-4 py-3">
				<Button variant="ghost" size="sm" onClick={() => router.push("/projects")}>
					<HugeiconsIcon icon={Cancel01Icon} className="size-4" /> 返回
				</Button>
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-sm font-semibold">
						<HugeiconsIcon icon={AiVoiceIcon} className="text-primary size-4" />
						批量配音中心
					</div>
					<div className="text-muted-foreground truncate text-xs">
						{course.name} · {course.total} 节 · 英文 → 中文
					</div>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<div className="hidden w-48 sm:block">
						<div className="text-muted-foreground flex justify-between text-[11px]">
							<span>
								{counts.done + counts.review}/{lessons.length} 完成
							</span>
							<span>{overallPct}%</span>
						</div>
						<div className="bg-muted h-1.5 overflow-hidden rounded-full">
							<div
								className="bg-primary h-full transition-[width]"
								style={{ width: `${overallPct}%` }}
							/>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => useCourseStore.getState().openImport()}
					>
						<HugeiconsIcon icon={UploadIcon} className="size-4" /> 导入课程
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={batchRunning || exporting}
						onClick={async () => {
							if (
								!window.confirm("清空当前课程并重新导入？（不会删除你磁盘上的文件）")
							)
								return;
							await useCourseStore.getState().reset();
							useCourseStore.getState().openImport();
						}}
					>
						<HugeiconsIcon icon={Delete02Icon} className="size-4" /> 清空重导
					</Button>
					<Button
						size="sm"
						disabled={batchRunning || counts.queued === 0}
						onClick={() => void runCourseBatch({})}
					>
						{batchRunning ? (
							<>
								<HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
								处理中…
							</>
						) : counts.queued > 0 ? (
							<>
								<HugeiconsIcon icon={SparklesIcon} className="size-4" /> 开始批量生成 ·{" "}
								{counts.queued} 节
							</>
						) : (
							<>
								<HugeiconsIcon icon={Tick02Icon} className="size-4" /> 全部已生成
							</>
						)}
					</Button>
					{batchRunning && (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									useCourseStore.getState().setPaused({ paused: !paused })
								}
							>
								{paused ? "恢复" : "暂停"}
							</Button>
							<Button variant="outline" size="sm" onClick={() => stopCourseRun()}>
								停止
							</Button>
						</>
					)}
					{counts.done + counts.review > 0 && (
						<>
							<Button
								variant="outline"
								size="sm"
								disabled={exporting || batchRunning}
								onClick={() => void runExport("folder")}
							>
								<HugeiconsIcon icon={UploadIcon} className="size-4" /> 导出到 _localized
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={exporting || batchRunning}
								onClick={() => void runExport("zip")}
							>
								导出 ZIP
							</Button>
						</>
					)}
				</div>
			</header>

			{needsPermission && (
				<div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-600 dark:text-amber-500">
					<HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" />
					课程已恢复，但浏览器需要你重新授权课程文件夹才能继续。
					<Button
						size="sm"
						variant="outline"
						className="h-6 text-xs"
						onClick={async () => {
							const ok = await useCourseStore.getState().restorePermission();
							if (!ok) toast.error("授权未通过，请重试");
						}}
					>
						恢复文件夹授权
					</Button>
				</div>
			)}

			{exporting && (
				<div className="bg-primary/5 flex items-center gap-2 border-b px-4 py-1.5 text-xs">
					<HugeiconsIcon icon={Loading03Icon} className="text-primary size-3.5 animate-spin" />
					导出中 {exportDone}/{exportTotal}
					{exportCurrent ? ` · ${exportCurrent}` : ""}（渲染较重，请耐心等待）
				</div>
			)}

			{/* shared config */}
			<div className="flex items-center gap-2 border-b px-4 py-2 text-xs">
				<span className="text-muted-foreground">统一配置（整门课程）</span>
				<button
					type="button"
					className="hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1"
					onClick={() =>
						setSetting({
							key: "voiceId",
							value: VOICES[(voiceIdx + 1) % VOICES.length].id,
						})
					}
				>
					<span
						className="flex size-4 items-center justify-center rounded-full text-[9px] font-semibold text-white"
						style={{ background: `oklch(0.55 0.13 ${voice.hue})` }}
					>
						{voice.name[0]}
					</span>
					音色 · {voice.name}
				</button>
				<button
					type="button"
					className="hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1"
					onClick={() =>
						setSetting({
							key: "originalAudio",
							value: settings.originalAudio === "mute" ? "background" : "mute",
						})
					}
				>
					<HugeiconsIcon icon={VolumeOffIcon} className="size-3.5" />
					原声 · {settings.originalAudio === "mute" ? "静音" : "背景"}
				</button>
				<button
					type="button"
					className="hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1"
					onClick={() => setSetting({ key: "subtitles", value: !settings.subtitles })}
				>
					字幕 · {settings.subtitles ? (settings.subtitleMode === "burn" ? "烧录" : "软") : "无"}
				</button>
				<button
					type="button"
					className={cn(
						"hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1",
						autoExport && "border-primary/40 bg-primary/10 text-primary",
					)}
					onClick={() =>
						useCourseStore.getState().setAutoExport({ autoExport: !autoExport })
					}
				>
					生成后自动导出 · {autoExport ? "开" : "关"}
				</button>
				<span className="text-muted-foreground ml-auto flex items-center gap-1 text-[11px]">
					<HugeiconsIcon icon={InformationCircleIcon} className="size-3" />
					逐课可在编辑台单独覆盖
				</span>
			</div>

			{/* toolbar */}
			<div className="flex items-center gap-2 border-b px-4 py-2">
				<div className="flex gap-1">
					{TABS.map(([k, label]) => (
						<button
							type="button"
							key={k}
							onClick={() => setFilter(k)}
							className={cn(
								"flex items-center gap-1 rounded-md px-2 py-1 text-xs",
								filter === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted",
							)}
						>
							{label}
							<span
								className={cn(
									"rounded px-1 text-[10px]",
									k === "failed" && counts.failed > 0
										? "bg-red-500/20 text-red-500"
										: k === "review" && counts.review > 0
											? "bg-amber-500/20 text-amber-500"
											: "bg-muted",
								)}
							>
								{counts[k === "all" ? "all" : (k as LessonStatus)]}
							</span>
						</button>
					))}
				</div>
				<div className="border-border ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1">
					<HugeiconsIcon icon={Search01Icon} className="text-muted-foreground size-3.5" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="搜索课时…"
						className="bg-transparent text-xs outline-none"
					/>
				</div>
			</div>

			{/* table */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="text-muted-foreground bg-muted/40 sticky top-0 grid grid-cols-[28px_44px_1fr_120px_110px_1fr_92px] items-center gap-2 border-b px-3 py-1.5 text-[11px]">
					<input type="checkbox" checked={allSelected} onChange={toggleAll} />
					<span>#</span>
					<span>课时</span>
					<span>语言</span>
					<span>状态</span>
					<span>提示</span>
					<span className="text-right">操作</span>
				</div>
				{filtered.length === 0 ? (
					<div className="text-muted-foreground p-8 text-center text-sm">
						该筛选下没有课时
					</div>
				) : (
					filtered.map((lesson) => (
						<LessonRow
							key={lesson.id}
							lesson={lesson}
							selected={selection.includes(lesson.id)}
							onToggle={() => useCourseStore.getState().toggleSelect({ id: lesson.id })}
							onOpen={() => openLesson(lesson)}
							onRun={() => void runCourseBatch({ onlyIds: [lesson.id] })}
							onApprove={() => {
								useCourseStore.getState().updateLesson({
									id: lesson.id,
									patch: { status: "done" },
								});
								toast.success(`「${lesson.title}」已标记复核通过`);
							}}
						/>
					))
				)}
			</div>

			{/* bulk bar */}
			{selection.length > 0 && (
				<div className="flex items-center gap-2 border-t px-4 py-2 text-xs">
					<span className="font-medium">{selection.length} 节已选</span>
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs"
						disabled={batchRunning}
						onClick={() => void runCourseBatch({ onlyIds: selection })}
					>
						<HugeiconsIcon icon={RefreshIcon} className="size-3" /> 重新生成所选
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs"
						disabled={exporting || batchRunning}
						onClick={() => void runExport("zip", selection)}
					>
						<HugeiconsIcon icon={UploadIcon} className="size-3" /> 导出所选 ZIP
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="h-7 text-xs text-red-500"
						disabled={batchRunning}
						onClick={() => {
							if (!window.confirm(`从列表移除 ${selection.length} 节？（不会删除磁盘文件）`))
								return;
							useCourseStore.getState().removeLessons({ ids: selection });
						}}
					>
						<HugeiconsIcon icon={Delete02Icon} className="size-3" /> 移除所选
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="ml-auto h-7 text-xs"
						onClick={() => useCourseStore.getState().clearSelection()}
					>
						清除
					</Button>
				</div>
			)}
		</div>
	);
}
