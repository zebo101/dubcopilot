"use client";

// 配音设置 — lives in the RIGHT properties panel while the AI 配音 tab is
// active. These are properties of the dub (voice / original audio / subtitles
// / speed / credentials), adjustable at ANY phase — notably during review,
// which is the natural moment to audition voices and re-apply.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowRight01Icon,
	Cancel01Icon,
	DashboardSpeed02Icon,
	PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import { useEditor } from "@/editor/use-editor";
import { useDubStore } from "@/dub/store";
import { useDubCredentials, hasTtsKey } from "@/dub/credentials";
import { linearToDb } from "@/dub/original-audio";
import { VOICES } from "@/dub/data";
import {
	hueFromId,
	useAllVoices,
	useCustomVoices,
} from "@/dub/custom-voices";

function CredField({
	label,
	value,
	onChange,
	type = "text",
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: "text" | "password";
	placeholder?: string;
}) {
	return (
		<label className="block space-y-1">
			<span className="text-muted-foreground text-[11px]">{label}</span>
			<input
				type={type}
				value={value}
				placeholder={placeholder}
				spellCheck={false}
				autoComplete="off"
				onChange={(e) => onChange(e.target.value)}
				className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
			/>
		</label>
	);
}

export function CredentialsSection() {
	const cred = useDubCredentials();
	const configured = hasTtsKey(cred);
	// new users land with no key — open the section for them so the required
	// fields are visible without hunting; configured users get it collapsed
	const [open, setOpen] = useState(() => !configured);

	return (
		<div
			className={cn(
				"rounded-md border",
				!configured && "border-amber-500/40 bg-amber-500/5",
			)}
		>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
			>
				<span className="font-medium">语音 / 翻译 凭据</span>
				<span
					className={cn(
						"rounded px-1.5 text-[10px]",
						configured
							? "bg-emerald-500/15 text-emerald-500"
							: "bg-amber-500/15 text-amber-500",
					)}
				>
					{configured ? "已配置" : "未配置"}
				</span>
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					className={cn(
						"text-muted-foreground ml-auto size-4 transition-transform",
						open && "rotate-90",
					)}
				/>
			</button>
			{open ? (
				<div className="space-y-3 border-t p-3">
					<div className="space-y-2">
						<div className="text-[11px] font-medium">豆包语音 TTS</div>
						<CredField
							label="API Key（必填）"
							type="password"
							placeholder="VOLCENGINE_TTS_API_KEY"
							value={cred.ttsApiKey}
							onChange={(v) => cred.setField({ key: "ttsApiKey", value: v })}
						/>
						<CredField
							label="Resource ID"
							value={cred.ttsResourceId}
							onChange={(v) => cred.setField({ key: "ttsResourceId", value: v })}
						/>
						<CredField
							label="TTS URL"
							value={cred.ttsUrl}
							onChange={(v) => cred.setField({ key: "ttsUrl", value: v })}
						/>
						<CredField
							label="Cluster"
							value={cred.ttsCluster}
							onChange={(v) => cred.setField({ key: "ttsCluster", value: v })}
						/>
					</div>
					<div className="space-y-2">
						<div className="text-[11px] font-medium">DeepSeek 翻译</div>
						<CredField
							label="API Key（必填）"
							type="password"
							placeholder="sk-..."
							value={cred.deepseekApiKey}
							onChange={(v) => cred.setField({ key: "deepseekApiKey", value: v })}
						/>
						<CredField
							label="Base URL"
							value={cred.deepseekBaseUrl}
							onChange={(v) =>
								cred.setField({ key: "deepseekBaseUrl", value: v })
							}
						/>
						<CredField
							label="模型（V4 默认 deepseek-chat）"
							value={cred.deepseekModel}
							onChange={(v) => cred.setField({ key: "deepseekModel", value: v })}
						/>
					</div>
					<div className="space-y-2">
						<div className="text-[11px] font-medium">Groq 云端转写</div>
						<CredField
							label="API Key（云端转写用）"
							type="password"
							placeholder="gsk_..."
							value={cred.groqApiKey}
							onChange={(v) => cred.setField({ key: "groqApiKey", value: v })}
						/>
						<CredField
							label="Base URL"
							value={cred.groqBaseUrl}
							onChange={(v) => cred.setField({ key: "groqBaseUrl", value: v })}
						/>
						<CredField
							label="模型"
							value={cred.groqModel}
							onChange={(v) => cred.setField({ key: "groqModel", value: v })}
						/>
					</div>
					<div className="flex items-center gap-2 pt-1">
						<Button
							size="sm"
							className="h-7 text-xs"
							onClick={() =>
								toast.success("凭据已保存到本地浏览器，刷新不会丢失")
							}
						>
							保存
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-7 text-xs"
							onClick={() => {
								cred.reset();
								toast("已清除凭据");
							}}
						>
							清除
						</Button>
						<span className="text-muted-foreground text-[10px]">
							输入即自动保存
						</span>
					</div>
					<p className="text-muted-foreground text-[10px] leading-relaxed">
						凭据仅存本地浏览器（localStorage），不上传服务器、刷新不丢；仅用于经薄代理调用你自己的 DeepSeek / 豆包接口。
					</p>
				</div>
			) : null}
		</div>
	);
}

/**
 * Voice gallery — presets plus user-added voices. Any Volcengine BigTTS
 * voice_type can be added (the gallery is a convenience, not a whitelist);
 * custom voices persist globally in localStorage and can be removed.
 */
function VoiceGallery() {
	const settings = useDubStore((s) => s.settings);
	const setSetting = useDubStore((s) => s.setSetting);
	const phase = useDubStore((s) => s.phase);
	const voices = useAllVoices();
	const customVoices = useCustomVoices((s) => s.voices);
	const addVoice = useCustomVoices((s) => s.addVoice);
	const removeVoice = useCustomVoices((s) => s.removeVoice);

	const [adding, setAdding] = useState(false);
	const [draftName, setDraftName] = useState("");
	const [draftId, setDraftId] = useState("");
	const [draftDesc, setDraftDesc] = useState("");

	const isCustom = (id: string) => customVoices.some((v) => v.id === id);

	const submit = () => {
		const id = draftId.trim();
		const name = draftName.trim() || id;
		if (!id) {
			toast.error("请填写音色 ID（voice_type）");
			return;
		}
		if (voices.some((v) => v.id === id)) {
			toast.error("该音色 ID 已存在");
			return;
		}
		addVoice({
			voice: {
				id,
				name,
				genderLabel: "自定义",
				style: draftDesc.trim() || "用户添加",
				desc: draftDesc.trim() || "用户添加的音色",
				hue: hueFromId(id),
			},
		});
		setSetting({ key: "voiceId", value: id });
		setAdding(false);
		setDraftName("");
		setDraftId("");
		setDraftDesc("");
		toast.success(`已添加音色「${name}」并选中`);
	};

	const remove = (id: string) => {
		removeVoice({ id });
		if (settings.voiceId === id) {
			setSetting({ key: "voiceId", value: VOICES[0].id });
		}
	};

	return (
		<div className="space-y-2">
			<div className="text-muted-foreground text-xs font-medium">配音音色</div>
			<div className="grid grid-cols-2 gap-2">
				{voices.map((v) => {
					const selected = settings.voiceId === v.id;
					const custom = isCustom(v.id);
					return (
						<div
							key={v.id}
							className={cn(
								"group relative rounded-md border transition-colors",
								selected
									? "border-primary bg-primary/10"
									: "border-border hover:bg-muted",
							)}
						>
							<button
								type="button"
								onClick={() => setSetting({ key: "voiceId", value: v.id })}
								title={v.desc}
								className="flex w-full flex-col items-start gap-1 p-2.5 text-left"
							>
								<div className="flex w-full items-center gap-2">
									<span
										className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
										style={{ background: `oklch(0.55 0.13 ${v.hue})` }}
									>
										{v.name[0]}
									</span>
									<span className="truncate text-sm font-medium">{v.name}</span>
									{v.recommended ? (
										<span className="bg-primary/20 text-primary ml-auto shrink-0 rounded px-1 text-[10px]">
											推荐
										</span>
									) : null}
								</div>
								<span className="text-muted-foreground w-full truncate text-[11px]">
									{custom ? v.style : `${v.genderLabel} · ${v.style}`}
								</span>
							</button>
							{custom ? (
								<button
									type="button"
									title="删除该音色"
									onClick={() => remove(v.id)}
									className="bg-background text-muted-foreground hover:text-destructive absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full border group-hover:flex"
								>
									<HugeiconsIcon icon={Cancel01Icon} className="size-2.5" />
								</button>
							) : null}
						</div>
					);
				})}

				{/* add-voice card / inline form */}
				{adding ? (
					<div className="border-primary/40 col-span-2 space-y-1.5 rounded-md border border-dashed p-2.5">
						<div className="text-xs font-medium">添加音色</div>
						<input
							value={draftId}
							onChange={(e) => setDraftId(e.target.value)}
							placeholder="音色 ID（voice_type），如 zh_male_..."
							spellCheck={false}
							autoComplete="off"
							className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
						/>
						<input
							value={draftName}
							onChange={(e) => setDraftName(e.target.value)}
							placeholder="显示名称（选填，默认用 ID）"
							className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
						/>
						<input
							value={draftDesc}
							onChange={(e) => setDraftDesc(e.target.value)}
							placeholder="备注，如「女声 · 活泼」（选填）"
							className="border-border bg-background w-full rounded border px-2 py-1 text-xs"
						/>
						<div className="flex items-center gap-2 pt-0.5">
							<Button size="sm" className="h-6 text-xs" onClick={submit}>
								添加
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="h-6 text-xs"
								onClick={() => setAdding(false)}
							>
								取消
							</Button>
							<span className="text-muted-foreground ml-auto text-[10px]">
								豆包 BigTTS 任意 voice_type
							</span>
						</div>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="border-border text-muted-foreground hover:border-primary/40 hover:text-foreground flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-md border border-dashed p-2.5 text-[11px] transition-colors"
					>
						<HugeiconsIcon icon={PlusSignIcon} className="size-4" />
						添加音色
					</button>
				)}
			</div>
			{phase === "review" ? (
				<p className="text-muted-foreground text-[10px]">
					提示：在左侧句列表点 ▶ 可用当前音色试听单句。
				</p>
			) : null}
		</div>
	);
}

/** Fixed original-audio gears — clearer than a slider for quick A/B review. */
const VOLUME_GEARS: { label: string; value: number | "mute" }[] = [
	{ label: "静音", value: "mute" },
	{ label: "轻 5%", value: 0.05 },
	{ label: "标准 12%", value: 0.12 },
	{ label: "明显 25%", value: 0.25 },
];

/**
 * Compact original-audio gear row, usable from ANY panel (the right-side
 * 配音设置 disappears whenever a timeline element is selected — this lives in
 * the left review column too, so the control is always reachable).
 */
export function OriginalAudioQuickControl() {
	const editor = useEditor();
	const settings = useDubStore((s) => s.settings);
	const setSetting = useDubStore((s) => s.setSetting);

	const apply = (value: number | "mute") => {
		const scene = editor.scenes.getActiveSceneOrNull();
		const main = scene?.tracks.main;
		if (value === "mute") {
			setSetting({ key: "originalAudio", value: "mute" });
			if (main && !main.muted)
				editor.timeline.toggleTrackMute({ trackId: main.id });
			return;
		}
		setSetting({ key: "originalAudio", value: "background" });
		setSetting({ key: "backgroundVolume", value });
		if (!main) return;
		if (main.muted) editor.timeline.toggleTrackMute({ trackId: main.id });
		if (main.elements.length > 0) {
			editor.timeline.updateElements({
				updates: main.elements.map((el) => ({
					trackId: main.id,
					elementId: el.id,
					patch: { params: { ...el.params, volume: linearToDb(value) } },
				})),
				pushHistory: false,
			});
		}
	};

	const isActive = (value: number | "mute") =>
		value === "mute"
			? settings.originalAudio === "mute"
			: settings.originalAudio === "background" &&
				Math.abs(settings.backgroundVolume - value) < 0.001;

	return (
		<div className="flex items-center gap-1 text-[11px]">
			<span className="text-muted-foreground shrink-0">原声</span>
			{VOLUME_GEARS.map((g) => (
				<button
					type="button"
					key={g.label}
					onClick={() => apply(g.value)}
					className={cn(
						"rounded-md border px-1.5 py-0.5 transition-colors",
						isActive(g.value)
							? "border-primary/40 bg-primary/10 text-primary"
							: "border-border text-muted-foreground hover:bg-muted",
					)}
				>
					{g.label}
				</button>
			))}
		</div>
	);
}

export function DubSettingsPanel() {
	const editor = useEditor();
	const settings = useDubStore((s) => s.settings);
	const setSetting = useDubStore((s) => s.setSetting);
	const phase = useDubStore((s) => s.phase);

	// 原声处理 acts LIVE on the open project's main video track — 复核时拖动
	// 滑杆立刻能听到效果，不必等下一次「② 合成应用」。Volume tweaks skip the
	// undo stack (pushHistory:false) so dragging doesn't spam history.
	const applyOriginalAudioLive = ({
		mode,
		volume,
	}: {
		mode: "mute" | "background";
		volume: number;
	}) => {
		const scene = editor.scenes.getActiveSceneOrNull();
		const main = scene?.tracks.main;
		if (!main) return;
		if (mode === "mute") {
			if (!main.muted) editor.timeline.toggleTrackMute({ trackId: main.id });
			return;
		}
		if (main.muted) editor.timeline.toggleTrackMute({ trackId: main.id });
		if (main.elements.length > 0) {
			editor.timeline.updateElements({
				updates: main.elements.map((el) => ({
					trackId: main.id,
					elementId: el.id,
					// params.volume is in dB — raw 0–1 ratios are inaudible no-ops
					patch: { params: { ...el.params, volume: linearToDb(volume) } },
				})),
				pushHistory: false,
			});
		}
	};

	// Every timeline update restarts the audio engine (it re-collects clips and
	// reschedules from the playhead) — applying on EVERY slider tick during a
	// drag caused a restart storm and audible stutter. Debounce the volume
	// application; mode switches still apply immediately.
	const volumeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
	const applyVolumeDebounced = (volume: number) => {
		if (volumeDebounce.current) clearTimeout(volumeDebounce.current);
		volumeDebounce.current = setTimeout(() => {
			volumeDebounce.current = null;
			applyOriginalAudioLive({ mode: "background", volume });
		}, 150);
	};

	return (
		<div className="space-y-5 p-4">
			<div>
				<div className="text-sm font-semibold">配音设置</div>
				<p className="text-muted-foreground text-[11px]">
					任何阶段都可调整{phase === "review" ? "——改完点左侧「合成配音并应用」生效" : ""}
				</p>
			</div>

			{/* credentials live at the TOP — without keys nothing below works, so
			    new users must see this first (it auto-expands when unconfigured) */}
			<CredentialsSection />

			<VoiceGallery />

			{/* original audio — changes apply LIVE to the open project */}
			<div className="space-y-2">
				<div className="text-muted-foreground text-xs font-medium">
					原声处理
					<span className="text-muted-foreground/70 ml-1 text-[10px]">
						（实时生效，可边播边调）
					</span>
				</div>
				<OriginalAudioQuickControl />
				<div className="bg-muted inline-flex rounded-md p-0.5">
					{(["mute", "background"] as const).map((mode) => (
						<button
							type="button"
							key={mode}
							onClick={() => {
								setSetting({ key: "originalAudio", value: mode });
								applyOriginalAudioLive({
									mode,
									volume: settings.backgroundVolume,
								});
							}}
							className={cn(
								"rounded px-3 py-1 text-xs transition-colors",
								settings.originalAudio === mode
									? "bg-background shadow-sm"
									: "text-muted-foreground",
							)}
						>
							{mode === "mute" ? "静音原声" : "保留为背景"}
						</button>
					))}
				</div>
				{settings.originalAudio === "background" ? (
					<div className="pt-1">
						<div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
							<span>背景音量</span>
							<span>{Math.round(settings.backgroundVolume * 100)}%</span>
						</div>
						<input
							type="range"
							min={0}
							max={0.5}
							step={0.01}
							value={settings.backgroundVolume}
							onChange={(e) => {
								const volume = Number(e.target.value);
								setSetting({ key: "backgroundVolume", value: volume });
								applyVolumeDebounced(volume);
							}}
							className="w-full"
						/>
					</div>
				) : null}
			</div>

			{/* subtitles */}
			<div className="space-y-2">
				<label className="flex cursor-pointer items-center justify-between">
					<span className="text-sm">同时生成中文字幕</span>
					<input
						type="checkbox"
						checked={settings.subtitles}
						onChange={(e) =>
							setSetting({ key: "subtitles", value: e.target.checked })
						}
					/>
				</label>
				{settings.subtitles ? (
					<div className="bg-muted inline-flex rounded-md p-0.5">
						{(["soft", "burn"] as const).map((mode) => (
							<button
								type="button"
								key={mode}
								onClick={() => setSetting({ key: "subtitleMode", value: mode })}
								className={cn(
									"rounded px-3 py-1 text-xs transition-colors",
									settings.subtitleMode === mode
										? "bg-background shadow-sm"
										: "text-muted-foreground",
								)}
							>
								{mode === "soft" ? "软字幕（可关）" : "烧录到画面"}
							</button>
						))}
					</div>
				) : null}
			</div>

			{/* speed & alignment — no longer hidden behind an "advanced" toggle */}
			<div className="space-y-3 rounded-md border p-3">
				<div className="flex items-center gap-2 text-xs font-medium">
					<HugeiconsIcon
						icon={DashboardSpeed02Icon}
						className="text-muted-foreground size-4"
					/>
					语速与对齐
				</div>
				<label className="flex cursor-pointer items-start justify-between gap-2">
					<span className="flex flex-col">
						<span className="text-xs">语速自适应</span>
						<span className="text-muted-foreground text-[10px]">
							译文偏长时自动加速，贴合原时长
						</span>
					</span>
					<input
						type="checkbox"
						checked={settings.speedAdaptive}
						onChange={(e) =>
							setSetting({ key: "speedAdaptive", value: e.target.checked })
						}
					/>
				</label>
				<div>
					<div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
						<span>原生最大语速</span>
						<span>×{settings.nativeMaxSpeed.toFixed(2)}</span>
					</div>
					<input
						type="range"
						min={1}
						max={1.6}
						step={0.05}
						value={settings.nativeMaxSpeed}
						onChange={(e) =>
							setSetting({ key: "nativeMaxSpeed", value: Number(e.target.value) })
						}
						className="w-full"
					/>
				</div>
				<div>
					<div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
						<span>最大变速</span>
						<span>×{settings.maxSpeedup.toFixed(1)}</span>
					</div>
					<input
						type="range"
						min={1.5}
						max={3}
						step={0.1}
						value={settings.maxSpeedup}
						onChange={(e) =>
							setSetting({ key: "maxSpeedup", value: Number(e.target.value) })
						}
						className="w-full"
					/>
				</div>
				<div className="text-muted-foreground flex justify-between text-[11px]">
					<span>重叠保护</span>
					<span>{settings.overlapGuardMs} ms</span>
				</div>
			</div>
		</div>
	);
}
