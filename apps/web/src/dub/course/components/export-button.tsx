"use client";

// 导出 split button —— 把「导出动作 / 导出位置 / ZIP / 自动导出」收进一个入口。
// 此前导出按钮在页头、导出位置 chip 在配置行，按钮文案被远处的设置隐性控制，
// 用户点导出前根本不知道"去哪"是在另一行配的。

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowDown01Icon,
	Download04Icon,
	FolderUploadIcon,
	Loading03Icon,
} from "@hugeicons/core-free-icons";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils/ui";
import { useCourseStore } from "@/dub/course/store";
import {
	exportCourseToFolder,
	exportCourseToZip,
} from "@/dub/course/export-batch";

async function pickOutDir(): Promise<boolean> {
	try {
		const picked = await window.showDirectoryPicker?.({
			id: "dubcopilot-out",
			mode: "readwrite",
		});
		if (!picked) return false;
		useCourseStore.getState().setOutDirHandle({ handle: picked });
		return true;
	} catch {
		return false; // 取消选择
	}
}

export function ExportSplitButton({
	onlyIds,
	compact,
}: {
	/** 只导出这些课时（底部批量选中栏用）；不传 = 全部已完成 */
	onlyIds?: string[];
	/** 紧凑 outline 样式（批量选中栏），默认为页头的渐变主按钮 */
	compact?: boolean;
}) {
	const output = useCourseStore((s) => s.output);
	const outDirHandle = useCourseStore((s) => s.outDirHandle);
	const autoExport = useCourseStore((s) => s.autoExport);
	const exporting = useCourseStore((s) => s.exporting);
	const batchRunning = useCourseStore((s) => s.batchRunning);
	const course = useCourseStore((s) => s.course);
	// which export kind this instance kicked off — its own spinner, the other just disables
	const [exportKind, setExportKind] = useState<"folder" | "zip" | null>(null);

	const runExport = async (kind: "folder" | "zip") => {
		const setExport = useCourseStore.getState().setExport;
		setExportKind(kind);
		setExport({ exporting: true, done: 0, total: 0, current: "", pct: 0 });
		try {
			const fn = kind === "zip" ? exportCourseToZip : exportCourseToFolder;
			const res = await fn({
				onlyIds,
				onProgress: (p) =>
					setExport({ done: p.done, total: p.total, current: p.current, pct: p.pct }),
			});
			toast.success(`已导出 ${res.written} 节`);
		} catch (error) {
			// user closed the save-file dialog — not an error
			if (error instanceof DOMException && error.name === "AbortError") return;
			// worker/wasm rejections can be cross-realm (instanceof Error fails) —
			// surface whatever we got instead of a blind fallback
			console.error("[course-export] 导出失败:", error);
			const msg =
				error instanceof Error
					? error.message
					: typeof error === "object" && error !== null && "message" in error
						? String((error as { message: unknown }).message)
						: String(error);
			toast.error(msg && msg !== "undefined" ? msg : "导出失败（详情见控制台）");
		} finally {
			setExportKind(null);
			setExport({ exporting: false });
		}
	};

	const exportable = onlyIds
		? onlyIds.length
		: (course?.lessons ?? []).filter(
				(l) => l.status === "done" || l.status === "review",
			).length;
	const busy = exporting || batchRunning;
	const destLabel =
		output === "sibling"
			? "原目录/_localized"
			: (outDirHandle?.name ?? "指定目录");
	const mainLabel = onlyIds
		? `导出所选 · ${exportable} 节`
		: output === "sibling"
			? `存到原目录${exportable ? ` · ${exportable} 节` : ""}`
			: `导出到 ${destLabel}`;

	const setDest = (v: string) => {
		const s = useCourseStore.getState();
		if (v === "sibling") {
			s.setOutput({ output: "sibling" });
			return;
		}
		if (s.outDirHandle) {
			s.setOutput({ output: "new" });
			return;
		}
		// 切到指定目录前必须先真的选一个（用户手势内弹 picker）
		void (async () => {
			if (await pickOutDir()) {
				useCourseStore.getState().setOutput({ output: "new" });
			}
		})();
	};

	const menu = (
		<DropdownMenuContent align="end" className="w-60">
			<DropdownMenuLabel>导出位置（自动导出同用）</DropdownMenuLabel>
			<DropdownMenuRadioGroup value={output} onValueChange={setDest}>
				<DropdownMenuRadioItem value="sibling">
					原目录/_localized
				</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="new">
					<span className="truncate">
						指定目录{outDirHandle ? `：${outDirHandle.name}` : "…"}
					</span>
				</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
			{output === "new" && outDirHandle ? (
				<DropdownMenuItem
					className="text-muted-foreground pl-8 text-xs"
					onSelect={() => void pickOutDir()}
				>
					更换指定目录…
				</DropdownMenuItem>
			) : null}
			<DropdownMenuSeparator />
			<DropdownMenuItem
				disabled={busy || exportable === 0}
				onSelect={() => void runExport("zip")}
			>
				<HugeiconsIcon icon={Download04Icon} className="size-3.5" />
				{onlyIds ? "打包所选 ZIP" : "打包下载 ZIP"}
			</DropdownMenuItem>
			{!onlyIds && (
				<>
					<DropdownMenuSeparator />
					<DropdownMenuCheckboxItem
						checked={autoExport}
						onSelect={(e) => e.preventDefault()}
						onCheckedChange={(v) =>
							useCourseStore.getState().setAutoExport({ autoExport: v })
						}
					>
						生成后自动导出
					</DropdownMenuCheckboxItem>
				</>
			)}
		</DropdownMenuContent>
	);

	const mainDisabled = busy || exportable === 0;
	const mainContent =
		exportKind === "folder" ? (
			<>
				<HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" />
				<span>导出中…</span>
			</>
		) : (
			<>
				<HugeiconsIcon icon={FolderUploadIcon} className="size-3.5" />
				<span>{mainLabel}</span>
			</>
		);

	if (compact) {
		return (
			<DropdownMenu>
				<div className="flex items-stretch overflow-hidden rounded-md border">
					<button
						type="button"
						disabled={mainDisabled}
						onClick={() => void runExport("folder")}
						title={`导出到 ${destLabel}`}
						className="hover:bg-muted flex h-7 items-center gap-1 px-2 text-xs disabled:pointer-events-none disabled:opacity-50"
					>
						{mainContent}
					</button>
					<div className="bg-border w-px" />
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="hover:bg-muted flex items-center px-1 disabled:pointer-events-none disabled:opacity-50"
							aria-label="导出选项"
						>
							<HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
						</button>
					</DropdownMenuTrigger>
				</div>
				{menu}
			</DropdownMenu>
		);
	}

	return (
		<DropdownMenu>
			<div
				className={cn(
					"flex items-stretch rounded-md bg-[#38BDF8] p-[0.12rem] text-white",
				)}
			>
				<div className="relative flex items-stretch rounded-[0.4rem] bg-linear-270 from-[#2567EC] to-[#37B6F7] shadow-[0_1px_3px_0px_rgba(0,0,0,0.55)]">
					<button
						type="button"
						disabled={mainDisabled}
						onClick={() => void runExport("folder")}
						title={`导出全部已完成课时到 ${destLabel}`}
						className="z-10 flex items-center gap-1.5 px-3 py-1 text-sm disabled:pointer-events-none disabled:opacity-50"
					>
						{mainContent}
					</button>
					<div className="z-10 my-1 w-px bg-white/25" />
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="z-10 flex items-center px-1.5"
							aria-label="导出选项"
						>
							<HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
						</button>
					</DropdownMenuTrigger>
					<div className="pointer-events-none absolute inset-0 rounded-[0.4rem] bg-linear-to-t from-white/0 to-white/20" />
				</div>
			</div>
			{menu}
		</DropdownMenu>
	);
}
