// Per-project dub session persistence — the glue between the batch pipeline
// and the editor's 逐句编辑台. The batch engine (and the in-editor apply) save
// the reviewed segments here; opening that project later restores them and
// lands straight in review instead of a dead-end SetupView.

import { idbDel, idbGet, idbSet } from "@/dub/course/idb";
import type { DubSettings, Segment } from "@/dub/types";

export interface DubSession {
	projectId: string;
	segments: Segment[];
	settings: DubSettings;
	savedAt: number;
}

const key = (projectId: string) => `dub-session:${projectId}`;

export async function saveDubSession({
	projectId,
	segments,
	settings,
}: {
	projectId: string;
	segments: Segment[];
	settings: DubSettings;
}): Promise<void> {
	try {
		await idbSet(key(projectId), {
			projectId,
			segments,
			settings,
			savedAt: Date.now(),
		} satisfies DubSession);
	} catch (error) {
		console.error("saveDubSession failed", error);
	}
}

export async function loadDubSession({
	projectId,
}: {
	projectId: string;
}): Promise<DubSession | null> {
	try {
		return await idbGet<DubSession>(key(projectId));
	} catch {
		return null;
	}
}

export async function deleteDubSession({
	projectId,
}: {
	projectId: string;
}): Promise<void> {
	try {
		await idbDel(key(projectId));
	} catch {
		// nothing to clean
	}
}
