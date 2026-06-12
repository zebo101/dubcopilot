"use client";

// Editor-side review companion for the /course workspace.
// The batch UI itself lives at /course — inside the editor we only:
//  1. inject the zero-copy source video (staged by 批量中心's "打开") into the
//     media manager IN MEMORY (never persisted — that's the whole point);
//  2. self-heal a dub project whose video source is missing (page refresh /
//     opened from 全部项目): silently re-inject from the persisted folder
//     handle when permission is still granted, otherwise show a 恢复 button.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { useCourseStore } from "@/dub/course/store";
import { ensurePermission } from "@/dub/course/scan";
import { readVideoFile } from "@/media/mediabunny";
import type { MediaAsset } from "@/media/types";

export function CourseOverlay() {
	const editor = useEditor();
	const hydrate = useCourseStore((s) => s.hydrate);
	const hydrated = useCourseStore((s) => s.hydrated);
	const pending = useCourseStore((s) => s.pendingInjection);
	const course = useCourseStore((s) => s.course);
	const videoHandles = useCourseStore((s) => s.videoHandles);
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const mediaLoading = useEditor((e) => e.media.isLoadingMedia());
	const assets = useEditor((e) => e.media.getAssets());
	const [missingSource, setMissingSource] = useState(false);
	const [restoring, setRestoring] = useState(false);
	// one silent attempt per project — a failed getFile must not retry-loop
	const attemptedRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	// --- inject the staged zero-copy video once its project is active ---
	useEffect(() => {
		if (!pending || mediaLoading) return;
		if (activeProject?.metadata.id !== pending.projectId) return;
		const current = editor.media.getAssets();
		if (current.some((a) => a.id === pending.mediaId)) {
			useCourseStore.getState().setPendingInjection({ injection: null });
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const probe = await readVideoFile({ file: pending.file });
				if (cancelled) return;
				const asset: MediaAsset = {
					id: pending.mediaId,
					name: pending.file.name,
					type: "video",
					file: pending.file,
					// scene-builder gates VideoNode creation on a truthy url
					// (scene-builder.ts:64) even though frames decode from `file` —
					// without this the preview renders BLACK. clearAllAssets revokes it.
					url: URL.createObjectURL(pending.file),
					duration: probe.duration,
					width: probe.width,
					height: probe.height,
					fps: probe.fps,
					hasAudio: probe.hasAudio,
					thumbnailUrl: probe.thumbnailUrl ?? undefined,
				};
				// in-memory only — setAssets does NOT persist to browser storage
				editor.media.setAssets({
					assets: [...editor.media.getAssets(), asset],
				});
			} finally {
				if (!cancelled) {
					useCourseStore.getState().setPendingInjection({ injection: null });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [pending, activeProject, mediaLoading, editor]);

	// --- detect a dub project whose video source vanished (page refresh) ---
	useEffect(() => {
		if (pending || mediaLoading || !activeProject) {
			setMissingSource(false);
			return;
		}
		const scene =
			activeProject.scenes.find((s) => s.id === activeProject.currentSceneId) ??
			activeProject.scenes[0];
		if (!scene) return;
		const ids = new Set(assets.map((a) => a.id));
		const missing = scene.tracks.main.elements.some(
			(el) => el.type === "video" && !ids.has(el.mediaId),
		);
		// dub-generated projects are named "<title> · <语言>配音" — any language
		setMissingSource(missing && activeProject.metadata.name.includes("配音"));
	}, [pending, mediaLoading, activeProject, assets]);

	// the lesson this project came from — the key to self-healing
	const lesson =
		missingSource && activeProject
			? (course?.lessons.find(
					(l) =>
						l.projectId === activeProject.metadata.id && !!l.videoMediaId,
				) ?? null)
			: null;

	// --- silent auto-restore: permission still granted → re-inject directly ---
	useEffect(() => {
		if (!missingSource || !hydrated) return;
		if (!lesson?.projectId || !lesson.videoMediaId) return;
		if (attemptedRef.current.has(lesson.projectId)) return;
		const handle = videoHandles[lesson.id];
		if (!handle) return; // permission/handle missing — the button path handles it
		attemptedRef.current.add(lesson.projectId);
		void (async () => {
			try {
				const q = (
					handle as FileSystemFileHandle & {
						queryPermission?: (d: {
							mode: "read";
						}) => Promise<PermissionState>;
					}
				).queryPermission;
				const granted = q
					? (await q.call(handle, { mode: "read" })) === "granted"
					: true;
				if (!granted) return; // needs a user gesture — button path
				const file = await handle.getFile();
				useCourseStore.getState().setPendingInjection({
					injection: {
						projectId: lesson.projectId as string,
						mediaId: lesson.videoMediaId as string,
						file,
					},
				});
			} catch {
				// file vanished / read failed — banner stays with the fallback link
			}
		})();
	}, [missingSource, hydrated, lesson, videoHandles]);

	// user-gesture restore — may request folder permission
	const restoreSource = async () => {
		if (!lesson?.projectId || !lesson.videoMediaId) return;
		setRestoring(true);
		try {
			const s = useCourseStore.getState();
			// dir-level re-grant + rebuildHandles when the resume was blocked
			if (s.needsPermission || !s.videoHandles[lesson.id]) {
				const ok = await s.restorePermission();
				if (!ok) {
					toast.error("授权未通过，请重试或回批量中心");
					return;
				}
			}
			const handle = useCourseStore.getState().videoHandles[lesson.id];
			if (!handle || !(await ensurePermission({ handle }))) {
				toast.error("找不到视频文件，请回批量中心重新打开");
				return;
			}
			const file = await handle.getFile();
			attemptedRef.current.delete(lesson.projectId);
			useCourseStore.getState().setPendingInjection({
				injection: {
					projectId: lesson.projectId,
					mediaId: lesson.videoMediaId,
					file,
				},
			});
		} catch {
			toast.error("读取视频失败，请回批量中心重新打开");
		} finally {
			setRestoring(false);
		}
	};

	if (!missingSource) return null;
	return (
		<div className="fixed inset-x-0 top-12 z-50 mx-auto flex w-fit items-center gap-2 rounded-md border bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 shadow dark:text-amber-500">
			<span>视频源未注入（刷新会丢失内存中的视频引用）。</span>
			{lesson ? (
				<button
					type="button"
					disabled={restoring}
					className="rounded border border-current px-2 py-0.5 hover:bg-amber-500/15 disabled:opacity-60"
					onClick={() => void restoreSource()}
				>
					{restoring ? "恢复中…" : "恢复视频源"}
				</button>
			) : null}
			<span>
				或回{" "}
				<Link href="/course" className="underline">
					批量中心
				</Link>{" "}
				重新「打开」本课。
			</span>
		</div>
	);
}
