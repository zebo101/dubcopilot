"use client";

// /course — 课程本地化工作台（一级页面）。
// 导入整门课 → 并发批量生成中文配音 → triage 复核 → 批量导出。
// 全程无头：不需要 EditorProvider，编辑器只在逐课复核时使用。

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiVoiceIcon, Folder03Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { MobileGate } from "@/components/editor/mobile-gate";
import { useCourseStore } from "@/dub/course/store";
import { BatchCenter } from "@/dub/course/components/batch-center";
import { ImportCourse } from "@/dub/course/components/import-course";

function EmptyLanding() {
	const router = useRouter();
	return (
		<div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-4">
			<HugeiconsIcon icon={AiVoiceIcon} className="text-primary size-10" />
			<div className="text-center">
				<h1 className="text-lg font-semibold">课程本地化工作台</h1>
				<p className="text-muted-foreground mt-1 max-w-md text-sm">
					导入整门课程（100+ 视频），自动转写/翻译/配音为中文，并批量导出。
					视频全程本地处理，不上传。
				</p>
			</div>
			<div className="flex gap-2">
				<Button onClick={() => useCourseStore.getState().openImport()}>
					<HugeiconsIcon icon={Folder03Icon} className="size-4" /> 导入课程文件夹
				</Button>
				<Button variant="outline" onClick={() => router.push("/projects")}>
					返回项目列表
				</Button>
			</div>
		</div>
	);
}

export default function CoursePage() {
	const hydrate = useCourseStore((s) => s.hydrate);
	const hydrated = useCourseStore((s) => s.hydrated);
	const course = useCourseStore((s) => s.course);
	const view = useCourseStore((s) => s.view);

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	return (
		<MobileGate>
			{!hydrated ? (
				<div className="bg-background flex h-screen w-screen items-center justify-center gap-2 text-sm">
					<HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
					恢复课程进度…
				</div>
			) : (
				<>
					{course ? <BatchCenter /> : <EmptyLanding />}
					{view === "import" && <ImportCourse />}
				</>
			)}
		</MobileGate>
	);
}
