// Resolve where batch exports land, honoring the 导出位置 setting
// ("sibling" = <courseDir>/_localized, "new" = a user-picked directory).
// Before this existed the setting was UI-only and every export hardcoded
// _localized — the 另存新目录 option silently did nothing.

import { useCourseStore } from "@/dub/course/store";
import { ensurePermission } from "@/dub/course/scan";

/** interactive=false (auto-export mid-batch) can never prompt — it silently
 * falls back to <courseDir>/_localized when the saved handle is unusable. */
export async function resolveExportDir({
	interactive,
}: {
	interactive: boolean;
}): Promise<FileSystemDirectoryHandle> {
	const { output, dirHandle, outDirHandle, setOutDirHandle } =
		useCourseStore.getState();

	const sibling = async (): Promise<FileSystemDirectoryHandle> => {
		if (!dirHandle) throw new Error("找不到课程目录，请重新导入");
		return dirHandle.getDirectoryHandle("_localized", { create: true });
	};
	if (output === "sibling") return sibling();

	if (outDirHandle) {
		if (interactive) {
			if (await ensurePermission({ handle: outDirHandle })) return outDirHandle;
		} else {
			try {
				const q = (
					outDirHandle as FileSystemDirectoryHandle & {
						queryPermission?: (d: {
							mode: "readwrite";
						}) => Promise<PermissionState>;
					}
				).queryPermission;
				if (
					!q ||
					(await q.call(outDirHandle, { mode: "readwrite" })) === "granted"
				) {
					return outDirHandle;
				}
			} catch {
				// fall through to the sibling fallback below
			}
		}
	}
	if (!interactive) return sibling(); // can't prompt mid-batch

	if (!window.showDirectoryPicker) {
		throw new Error("浏览器不支持选择导出目录，请用 Chrome / Edge");
	}
	const picked = await window.showDirectoryPicker({
		id: "dubcopilot-out",
		mode: "readwrite",
	});
	setOutDirHandle({ handle: picked });
	return picked;
}
