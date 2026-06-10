"use client";

// Editor-side review companion for the /course workspace.
// The batch UI itself lives at /course — inside the editor we only:
//  1. inject the zero-copy source video (staged by 批量中心's "打开") into the
//     media manager IN MEMORY (never persisted — that's the whole point);
//  2. show a hint bar if a dub-review project's video source is missing
//     (page refresh dropped the in-memory file — reopen from /course).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEditor } from "@/editor/use-editor";
import { useCourseStore } from "@/dub/course/store";
import { readVideoFile } from "@/media/mediabunny";
import type { MediaAsset } from "@/media/types";

export function CourseOverlay() {
	const editor = useEditor();
	const hydrate = useCourseStore((s) => s.hydrate);
	const pending = useCourseStore((s) => s.pendingInjection);
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const mediaLoading = useEditor((e) => e.media.isLoadingMedia());
	const assets = useEditor((e) => e.media.getAssets());
	const [missingSource, setMissingSource] = useState(false);

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
		setMissingSource(missing && activeProject.metadata.name.includes("中文配音"));
	}, [pending, mediaLoading, activeProject, assets]);

	if (!missingSource) return null;
	return (
		<div className="fixed inset-x-0 top-12 z-50 mx-auto w-fit rounded-md border bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 shadow dark:text-amber-500">
			视频源未注入（刷新会丢失内存中的视频引用）——请回{" "}
			<Link href="/course" className="underline">
				批量中心
			</Link>{" "}
			重新「打开」本课。
		</div>
	);
}
