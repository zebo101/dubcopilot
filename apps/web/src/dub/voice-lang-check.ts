import { toast } from "sonner";
import { useDubStore } from "@/dub/store";
import { languageByCode } from "@/dub/languages";

// Layered reminder strategy: this TOAST fires at the moment of switching the
// target language (non-blocking, right when it's relevant); the persistent
// amber hints in the panels and the hard pre-synthesis guard already cover
// the "user ignored it" cases. A modal would be overkill for a recoverable
// misconfiguration.

/**
 * After the target language changes, warn if the currently selected voice is
 * a Chinese-family one (`zh_` prefix speaks 中文/中英混 only) while the new
 * target is not Chinese — synthesis would 400 or mispronounce.
 */
export function warnVoiceLanguageMismatch({
	targetLang,
}: {
	targetLang: string;
}): void {
	if (targetLang.startsWith("zh")) return;
	const { voiceId } = useDubStore.getState().settings;
	if (!voiceId.startsWith("zh_")) return;
	const label = languageByCode(targetLang).label;
	toast.warning(`记得换音色：当前音色可能不支持${label}`, {
		description:
			`「zh_」开头的中文系音色配${label}会失败或发音异常。` +
			`请在「配音音色」下拉中选择或添加支持${label}的音色（multi_ 系列等）。`,
		duration: 8000,
	});
}
