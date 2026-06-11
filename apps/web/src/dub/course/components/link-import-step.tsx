"use client";

// 粘贴链接导入：YouTube（单视频/播放列表）、Google Drive / OneDrive 分享链接、
// 直链 mp4 —— 解析成条目清单后下载进用户选的本地文件夹，再交给现有的
// 文件夹扫描流程（与本地导入完全同流，写回导出/断点续传不变）。

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Download04Icon,
	InformationCircleIcon,
	Loading03Icon,
	RefreshIcon,
	Tick02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import { useCourseStore } from "@/dub/course/store";
import { useDubStore } from "@/dub/store";
import { pickCourseDirectory } from "@/dub/course/scan";
import { classifyLink, type LinkKind } from "@/dub/course/link/parse";
import type { LinkItem, ResolveResponse } from "@/dub/course/link/types";
import {
	type DownloadTask,
	downloadOne,
	formatBytes,
	runDownloadPool,
} from "@/dub/course/link/client";

const PROXY_KEY = "dub-link-proxy";

const KIND_LABEL: Record<LinkKind, string> = {
	youtube: "YouTube",
	"youtube-playlist": "播放列表",
	gdrive: "Drive",
	"gdrive-folder": "Drive 文件夹",
	onedrive: "OneDrive",
	direct: "直链",
};

function kindBadgeCounts(text: string): { label: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const parsed = classifyLink(trimmed);
		const label = parsed ? KIND_LABEL[parsed.kind] : "无法识别";
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function TaskRow({ task }: { task: DownloadTask }) {
	const { item, status, pct, downloadedBytes, error } = task;
	return (
		<div className="space-y-1 rounded-md border px-2.5 py-2">
			<div className="flex items-center gap-2 text-xs">
				<span className="text-muted-foreground shrink-0 font-mono text-[10px]">
					{String(task.index).padStart(3, "0")}
				</span>
				<span className="min-w-0 flex-1 truncate" title={item.title}>
					{item.title}
				</span>
				<span className="text-muted-foreground shrink-0 text-[10px]">
					{KIND_LABEL[item.kind]}
				</span>
				<span
					className={cn(
						"shrink-0 text-[10px]",
						status === "done" && "text-emerald-500",
						status === "skipped" && "text-muted-foreground",
						status === "error" && "text-destructive",
						(status === "downloading" || status === "writing") &&
							"text-primary",
					)}
				>
					{status === "pending" && "等待"}
					{status === "downloading" &&
						(pct !== null
							? `${Math.round(pct)}%`
							: `${formatBytes(downloadedBytes)}…`)}
					{status === "writing" && "写入…"}
					{status === "done" && "✓ 完成"}
					{status === "skipped" && "已存在，跳过"}
					{status === "error" && "失败"}
				</span>
			</div>
			{(status === "downloading" || status === "writing") && (
				<div className="bg-muted h-1 overflow-hidden rounded-full">
					<div
						className={cn(
							"bg-primary h-full rounded-full transition-[width]",
							pct === null && "animate-pulse",
						)}
						style={{ width: `${pct ?? 100}%` }}
					/>
				</div>
			)}
			{status === "error" && error ? (
				<p className="text-destructive text-[10px] leading-relaxed">{error}</p>
			) : null}
		</div>
	);
}

export function LinkImportStep() {
	const scanning = useCourseStore((s) => s.scanning);
	const sourceLang = useDubStore((s) => s.settings.sourceLang);

	const [phase, setPhase] = useState<"paste" | "list" | "downloading" | "done">(
		"paste",
	);
	const [urlsText, setUrlsText] = useState("");
	const [proxy, setProxy] = useState(
		() =>
			(typeof window !== "undefined" && localStorage.getItem(PROXY_KEY)) || "",
	);
	const [resolving, setResolving] = useState(false);
	const [items, setItems] = useState<LinkItem[]>([]);
	const [ffmpegMissing, setFfmpegMissing] = useState(false);
	const [excluded, setExcluded] = useState<Set<string>>(new Set());
	const [tasks, setTasks] = useState<DownloadTask[]>([]);
	const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(
		null,
	);

	const badges = useMemo(() => kindBadgeCounts(urlsText), [urlsText]);
	const selectable = items.filter((i) => !i.error);
	const selected = selectable.filter((i) => !excluded.has(i.key));

	const saveProxy = (value: string) => {
		setProxy(value);
		localStorage.setItem(PROXY_KEY, value.trim());
	};

	const onResolve = async () => {
		const urls = urlsText
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		if (!urls.length) {
			toast.error("先粘贴至少一个链接");
			return;
		}
		setResolving(true);
		try {
			const res = await fetch("/api/dub/link/resolve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					urls,
					...(proxy.trim() ? { proxy: proxy.trim() } : {}),
				}),
			});
			if (!res.ok) throw new Error(`解析失败 ${res.status}`);
			const data = (await res.json()) as ResolveResponse;
			setItems(data.items);
			setFfmpegMissing(data.ffmpegMissing);
			setExcluded(new Set());
			setPhase("list");
			const failed = data.items.filter((i) => i.error).length;
			if (failed) toast.warning(`${failed} 个链接无法下载，已在列表标出`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "解析失败");
		} finally {
			setResolving(false);
		}
	};

	const updateTask = (key: string, patch: Partial<DownloadTask>) => {
		setTasks((prev) =>
			prev.map((t) => (t.item.key === key ? { ...t, ...patch } : t)),
		);
	};

	const runTasks = async ({
		handle,
		list,
	}: {
		handle: FileSystemDirectoryHandle;
		list: DownloadTask[];
	}) => {
		setPhase("downloading");
		// YouTube 顺带拉人工字幕：源语言 + 英文（自动检测时只拉英文）
		const subLangs = [
			...new Set(
				[sourceLang !== "auto" ? sourceLang : null, "en"].filter(
					(l): l is string => !!l,
				),
			),
		];
		await runDownloadPool({
			tasks: list,
			worker: async (task) => {
				try {
					await downloadOne({
						task,
						dirHandle: handle,
						proxy: proxy.trim() || undefined,
						subLangs,
						onUpdate: (patch) => updateTask(task.item.key, patch),
					});
				} catch (error) {
					updateTask(task.item.key, {
						status: "error",
						error: error instanceof Error ? error.message : String(error),
					});
				}
			},
		});
		setPhase("done");
	};

	const onStartDownload = async () => {
		if (!selected.length) {
			toast.error("没有可下载的条目");
			return;
		}
		const handle = await pickCourseDirectory();
		if (!handle) return;
		setDirHandle(handle);
		const list: DownloadTask[] = selected.map((item, i) => ({
			item,
			index: i + 1,
			status: "pending",
			pct: 0,
			downloadedBytes: 0,
			error: null,
		}));
		setTasks(list);
		await runTasks({ handle, list });
	};

	const onRetryFailed = async () => {
		if (!dirHandle) return;
		const failed = tasks.filter((t) => t.status === "error");
		setTasks((prev) =>
			prev.map((t) =>
				t.status === "error"
					? { ...t, status: "pending", pct: 0, downloadedBytes: 0, error: null }
					: t,
			),
		);
		await runTasks({
			handle: dirHandle,
			list: failed.map((t) => ({ ...t, status: "pending", error: null })),
		});
	};

	const onProceed = async () => {
		if (!dirHandle) return;
		try {
			await useCourseStore.getState().scanFolder({ dirHandle });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "扫描文件夹失败");
		}
	};

	const doneCount = tasks.filter(
		(t) => t.status === "done" || t.status === "skipped",
	).length;
	const failCount = tasks.filter((t) => t.status === "error").length;
	const overallPct = tasks.length
		? tasks.reduce((sum, t) => sum + (t.pct ?? 0), 0) / tasks.length
		: 0;

	return (
		<div className="space-y-4 p-5">
			<div>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground text-xs"
					onClick={() => useCourseStore.getState().backImportSource()}
				>
					← 重新选择来源
				</button>
				<h2 className="mt-1 text-base font-semibold">粘贴链接导入</h2>
				<p className="text-muted-foreground text-xs">
					支持 YouTube 视频/播放列表、Google Drive / OneDrive
					分享链接（需设为「任何人可查看」）、视频直链，每行一个。
				</p>
			</div>

			{phase === "paste" && (
				<>
					<textarea
						value={urlsText}
						onChange={(e) => setUrlsText(e.target.value)}
						placeholder={
							"https://www.youtube.com/playlist?list=…\nhttps://drive.google.com/file/d/…/view?usp=sharing\nhttps://cdn.example.com/lesson1.mp4"
						}
						spellCheck={false}
						rows={5}
						className="border-border bg-background w-full resize-y rounded-md border px-2.5 py-2 font-mono text-xs"
					/>
					{badges.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{badges.map((b) => (
								<span
									key={b.label}
									className={cn(
										"rounded px-1.5 py-0.5 text-[10px]",
										b.label === "无法识别"
											? "bg-destructive/10 text-destructive"
											: "bg-primary/10 text-primary",
									)}
								>
									{b.label} × {b.count}
								</span>
							))}
						</div>
					)}
					<div className="space-y-1">
						<input
							value={proxy}
							onChange={(e) => saveProxy(e.target.value)}
							placeholder="代理地址（选填），如 http://127.0.0.1:7890——留空用服务端环境变量"
							spellCheck={false}
							className="border-border bg-background w-full rounded border px-2 py-1.5 text-xs"
						/>
						<p className="text-muted-foreground text-[10px]">
							YouTube / Google Drive 在国内网络通常需要代理；百度网盘 /
							阿里云盘请用官方客户端同步到本地后，改用「本地文件夹」导入。
						</p>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground flex items-center gap-1 text-[10px]">
							<HugeiconsIcon icon={InformationCircleIcon} className="size-3" />
							请仅下载你有权使用的内容
						</span>
						<Button size="sm" onClick={() => void onResolve()} disabled={resolving}>
							{resolving ? (
								<HugeiconsIcon
									icon={Loading03Icon}
									className="size-4 animate-spin"
								/>
							) : null}
							{resolving ? "解析中…" : "解析链接"}
						</Button>
					</div>
				</>
			)}

			{phase === "list" && (
				<>
					<div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
						{items.map((item, i) => (
							<label
								key={item.key}
								className={cn(
									"flex items-center gap-2 rounded px-1.5 py-1 text-xs",
									item.error
										? "opacity-60"
										: "hover:bg-muted cursor-pointer",
								)}
							>
								<input
									type="checkbox"
									disabled={!!item.error}
									checked={!item.error && !excluded.has(item.key)}
									onChange={(e) =>
										setExcluded((prev) => {
											const next = new Set(prev);
											if (e.target.checked) next.delete(item.key);
											else next.add(item.key);
											return next;
										})
									}
								/>
								<span className="text-muted-foreground shrink-0 font-mono text-[10px]">
									{String(i + 1).padStart(3, "0")}
								</span>
								<span className="min-w-0 flex-1 truncate" title={item.title}>
									{item.title}
								</span>
								<span className="text-muted-foreground shrink-0 text-[10px]">
									{KIND_LABEL[item.kind]}
									{item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}
									{item.subtitles.length ? " · 有字幕" : ""}
								</span>
								{item.error ? (
									<span className="text-destructive shrink-0 text-[10px]" title={item.error}>
										✕ 不可用
									</span>
								) : null}
							</label>
						))}
					</div>
					{ffmpegMissing && (
						<div className="rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-500">
							未检测到 ffmpeg——YouTube 视频将以 ≤720p 下载。安装后可下最高画质：
							<code className="font-mono">winget install ffmpeg</code>（装完重启 dev server）。
						</div>
					)}
					<div className="flex items-center justify-between">
						<button
							type="button"
							className="text-muted-foreground hover:text-foreground text-xs"
							onClick={() => setPhase("paste")}
						>
							← 重新粘贴
						</button>
						<Button size="sm" onClick={() => void onStartDownload()}>
							<HugeiconsIcon icon={Download04Icon} className="size-4" />
							选择保存文件夹，下载 {selected.length} 个
						</Button>
					</div>
					<p className="text-muted-foreground text-[10px]">
						建议新建一个空文件夹作为课程目录——下载完成后自动按「本地文件夹」流程扫描；
						中断后重新下载到同一文件夹会跳过已完成的视频。
					</p>
				</>
			)}

			{(phase === "downloading" || phase === "done") && (
				<>
					<div className="space-y-1">
						<div className="flex items-center justify-between text-xs">
							<span className="font-medium">
								{phase === "downloading" ? "下载中…" : "下载结束"}（{doneCount}/
								{tasks.length}
								{failCount ? `，${failCount} 失败` : ""}）
							</span>
							<span className="text-muted-foreground text-[10px]">
								{dirHandle ? `保存到：${dirHandle.name}` : ""}
							</span>
						</div>
						<div className="bg-muted h-1.5 overflow-hidden rounded-full">
							<div
								className="bg-primary h-full rounded-full transition-[width]"
								style={{ width: `${overallPct}%` }}
							/>
						</div>
					</div>
					<div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
						{tasks.map((t) => (
							<TaskRow key={t.item.key} task={t} />
						))}
					</div>
					{phase === "done" && (
						<div className="flex items-center justify-end gap-2">
							{failCount > 0 && (
								<Button
									size="sm"
									variant="outline"
									onClick={() => void onRetryFailed()}
								>
									<HugeiconsIcon icon={RefreshIcon} className="size-4" />
									重试失败的 {failCount} 个
								</Button>
							)}
							<Button
								size="sm"
								disabled={doneCount === 0 || scanning}
								onClick={() => void onProceed()}
							>
								{scanning ? (
									<HugeiconsIcon
										icon={Loading03Icon}
										className="size-4 animate-spin"
									/>
								) : (
									<HugeiconsIcon icon={Tick02Icon} className="size-4" />
								)}
								{scanning ? "扫描中…" : "扫描该文件夹并继续"}
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
