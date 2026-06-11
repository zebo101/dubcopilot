"use client";

import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Cancel01Icon,
	CloudUploadIcon,
	Folder03Icon,
	InformationCircleIcon,
	Loading03Icon,
	Tick02Icon,
	Video01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import { useCourseStore } from "@/dub/course/store";
import { isFolderImportSupported } from "@/dub/course/scan";
import { LinkImportStep } from "@/dub/course/components/link-import-step";
import { useDubStore } from "@/dub/store";
import { languageByCode } from "@/dub/languages";

function Segmented<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: [T, string][];
	onChange: (v: T) => void;
}) {
	return (
		<div className="bg-muted inline-flex rounded-md p-0.5">
			{options.map(([v, label]) => (
				<button
					type="button"
					key={v}
					onClick={() => onChange(v)}
					className={cn(
						"rounded px-3 py-1 text-xs transition-colors",
						value === v ? "bg-background shadow-sm" : "text-muted-foreground",
					)}
				>
					{label}
				</button>
			))}
		</div>
	);
}

function SourceStep() {
	const pickFolder = useCourseStore((s) => s.pickFolder);
	const scanning = useCourseStore((s) => s.scanning);

	const onPick = async () => {
		try {
			await pickFolder();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "无法打开文件夹");
		}
	};

	return (
		<div className="space-y-4 p-5">
			<div>
				<h2 className="text-base font-semibold">导入课程</h2>
				<p className="text-muted-foreground text-xs">
					整门课 100+ 节、几十 GB 时，用「本地文件夹」——按需读取、输出写回同目录，不必整包上传。
				</p>
			</div>

			<button
				type="button"
				onClick={onPick}
				disabled={scanning}
				className="border-primary bg-primary/5 hover:bg-primary/10 flex w-full items-center gap-3 rounded-lg border p-4 text-left disabled:opacity-60"
			>
				<HugeiconsIcon icon={scanning ? Loading03Icon : Folder03Icon} className={cn("text-primary size-7", scanning && "animate-spin")} />
				<div className="min-w-0">
					<div className="text-sm font-medium">
						选择本地文件夹 / U盘 <span className="text-primary text-[10px]">推荐</span>
					</div>
					<div className="text-muted-foreground text-xs">
						{scanning
							? "扫描中…"
							: "选课程目录，自动识别 .mp4 并配对同名 _en.srt/.vtt。本地直读、处理不上传、可断点续传。"}
					</div>
				</div>
			</button>

			<div className="grid grid-cols-2 gap-3">
				<button
					type="button"
					onClick={() => useCourseStore.getState().openLinkImport()}
					className="hover:bg-muted rounded-lg border p-3 text-left transition-colors"
				>
					<HugeiconsIcon icon={CloudUploadIcon} className="size-5" />
					<div className="mt-1 text-sm font-medium">从云盘导入</div>
					<div className="text-muted-foreground text-[11px]">
						Google Drive / OneDrive 分享链接直下；国内网盘请用官方客户端同步后走本地导入
					</div>
				</button>
				<button
					type="button"
					onClick={() => useCourseStore.getState().openLinkImport()}
					className="hover:bg-muted rounded-lg border p-3 text-left transition-colors"
				>
					<HugeiconsIcon icon={Video01Icon} className="size-5" />
					<div className="mt-1 text-sm font-medium">粘贴链接导入</div>
					<div className="text-muted-foreground text-[11px]">
						YouTube 视频/播放列表、视频直链——下载到本地文件夹后同流处理
					</div>
				</button>
			</div>

			{!isFolderImportSupported() && (
				<div className="rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-500">
					当前浏览器不支持本地文件夹访问，请用 Chrome / Edge 打开。
				</div>
			)}
		</div>
	);
}

function ScanStep() {
	const scan = useCourseStore((s) => s.scanResult);
	const missingPolicy = useCourseStore((s) => s.missingPolicy);
	const output = useCourseStore((s) => s.output);
	const confirmImport = useCourseStore((s) => s.confirmImport);
	const targetLang = useDubStore((s) => s.settings.targetLang);
	const targetLabel = languageByCode(targetLang).label;

	if (!scan) return null;
	const sample = scan.lessons.slice(0, 8);

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
				<h2 className="mt-1 text-base font-semibold">已扫描课程目录</h2>
				<p className="text-muted-foreground font-mono text-[11px]">{scan.rootName}</p>
			</div>

			<div className="grid grid-cols-3 gap-2 text-center">
				<div className="rounded-md border p-2">
					<div className="text-lg font-semibold">{scan.lessons.length}</div>
					<div className="text-muted-foreground text-[10px]">课时 (视频)</div>
				</div>
				<div className="rounded-md border p-2">
					<div className="text-lg font-semibold text-emerald-500">{scan.withSubtitle}</div>
					<div className="text-muted-foreground text-[10px]">含字幕（跳过转写）</div>
				</div>
				<div className="rounded-md border p-2">
					<div className="text-lg font-semibold text-amber-500">{scan.missing}</div>
					<div className="text-muted-foreground text-[10px]">缺字幕</div>
				</div>
			</div>

			{scan.ready > 0 && (
				<div className="rounded bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-600 dark:text-emerald-500">
					其中 {scan.ready} 节已是{targetLabel}字幕，将<b>直接配音、跳过翻译</b>；其余字幕会自动翻成{targetLabel}。
				</div>
			)}

			<div className="space-y-2">
				<div className="text-muted-foreground text-xs">缺字幕的课时怎么办</div>
				<Segmented
					value={missingPolicy}
					options={[
						["asr", "自动转写 (ASR · 慢)"],
						["skip", "跳过并标记失败"],
					]}
					onChange={(v) => useCourseStore.getState().setMissingPolicy({ policy: v })}
				/>
			</div>
			<div className="space-y-2">
				<div className="text-muted-foreground text-xs">导出位置（Phase 4）</div>
				<Segmented
					value={output}
					options={[
						["sibling", "写回 …/_localized"],
						["new", "另存新目录"],
					]}
					onChange={(v) => useCourseStore.getState().setOutput({ output: v })}
				/>
			</div>

			<div className="text-muted-foreground flex items-center gap-1 text-[11px]">
				<HugeiconsIcon icon={InformationCircleIcon} className="size-3" />
				本地处理，视频不离开你的设备；关闭页面后已授权目录仍可恢复。
			</div>

			<div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
				{sample.map((l) => (
					<div key={l.videoPath} className="flex items-center gap-2 text-xs">
						<HugeiconsIcon icon={Video01Icon} className="text-muted-foreground size-3.5" />
						<span className="truncate">{l.videoPath}</span>
						<span
							className={cn(
								"ml-auto shrink-0 text-[10px]",
								l.subtitleHandle ? "text-emerald-500" : "text-amber-500",
							)}
						>
							{l.subtitleLang === targetLang
								? `✓ ${targetLabel} · 直配`
								: l.subtitleHandle
									? "✓ 有字幕 · 翻译"
									: missingPolicy === "asr"
										? "将转写"
										: "将跳过"}
						</span>
					</div>
				))}
				{scan.lessons.length > sample.length && (
					<div className="text-muted-foreground pt-1 text-center text-[10px]">
						…另外 {scan.lessons.length - sample.length} 节
					</div>
				)}
			</div>

			<div className="flex justify-end gap-2">
				<Button variant="ghost" size="sm" onClick={() => useCourseStore.getState().closeImport()}>
					取消
				</Button>
				<Button size="sm" onClick={() => void confirmImport()}>
					<HugeiconsIcon icon={Tick02Icon} className="size-4" /> 导入 {scan.lessons.length} 节并进入批量中心
				</Button>
			</div>
		</div>
	);
}

export function ImportCourse() {
	const importStep = useCourseStore((s) => s.importStep);
	return (
		<div className="bg-background/80 fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
			<div className="bg-background w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl">
				<div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
					课程本地化 · 导入
					<button
						type="button"
						className="hover:bg-muted ml-auto rounded p-1"
						onClick={() => useCourseStore.getState().closeImport()}
					>
						<HugeiconsIcon icon={Cancel01Icon} className="size-4" />
					</button>
				</div>
				{importStep === "scan" ? (
					<ScanStep />
				) : importStep === "link" ? (
					<LinkImportStep />
				) : (
					<SourceStep />
				)}
			</div>
		</div>
	);
}
