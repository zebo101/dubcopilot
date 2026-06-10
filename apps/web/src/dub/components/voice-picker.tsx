"use client";

// Shared voice picker — presets + user-added voices in one dropdown, with the
// in-dropdown add form (any Volcengine BigTTS voice_type) and hover-× removal
// for custom voices. Two triggers: "panel" (配音设置 full-width row) and
// "chip" (批量中心统一配置 compact pill).

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowDown01Icon,
	Cancel01Icon,
	PlusSignIcon,
	Tick02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils/ui";
import { useDubStore } from "@/dub/store";
import { VOICES } from "@/dub/data";
import {
	hueFromId,
	useAllVoices,
	useCustomVoices,
} from "@/dub/custom-voices";
import { languageByCode } from "@/dub/languages";

/** Round colored initial for a voice — shared by trigger and list rows. */
export function VoiceAvatar({
	name,
	hue,
	size = "size-5",
}: {
	name: string;
	hue: number;
	size?: string;
}) {
	return (
		<span
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
				size,
			)}
			style={{ background: `oklch(0.55 0.13 ${hue})` }}
		>
			{name[0]}
		</span>
	);
}

export function VoicePicker({
	variant = "panel",
}: {
	variant?: "panel" | "chip";
}) {
	const settings = useDubStore((s) => s.settings);
	const setSetting = useDubStore((s) => s.setSetting);
	const phase = useDubStore((s) => s.phase);
	const voices = useAllVoices();
	const customVoices = useCustomVoices((s) => s.voices);
	const addVoice = useCustomVoices((s) => s.addVoice);
	const removeVoice = useCustomVoices((s) => s.removeVoice);

	const [open, setOpen] = useState(false);
	const [adding, setAdding] = useState(false);
	const [draftName, setDraftName] = useState("");
	const [draftId, setDraftId] = useState("");
	const [draftDesc, setDraftDesc] = useState("");

	const current = voices.find((v) => v.id === settings.voiceId) ?? voices[0];
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

	const trigger =
		variant === "chip" ? (
			<button
				type="button"
				className="hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1"
			>
				<VoiceAvatar name={current.name} hue={current.hue} size="size-4" />
				音色 · {current.name}
				<HugeiconsIcon
					icon={ArrowDown01Icon}
					className={cn(
						"text-muted-foreground size-3 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
		) : (
			<button
				type="button"
				className="border-border hover:bg-muted flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors"
			>
				<VoiceAvatar name={current.name} hue={current.hue} size="size-6" />
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium">
						{current.name}
					</span>
					<span className="text-muted-foreground block truncate text-[11px]">
						{isCustom(current.id)
							? current.style
							: `${current.genderLabel} · ${current.style}`}
					</span>
				</span>
				<HugeiconsIcon
					icon={ArrowDown01Icon}
					className={cn(
						"text-muted-foreground size-4 shrink-0 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
		);

	const picker = (
		<Popover
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) setAdding(false);
			}}
		>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent
				align="start"
				className={cn(
					"min-w-64 p-1",
					variant === "panel" && "w-[var(--radix-popover-trigger-width)]",
					variant === "chip" && "w-72",
				)}
			>
				{adding ? (
					<div className="space-y-1.5 p-1.5">
						<div className="text-xs font-medium">添加音色</div>
						<input
							value={draftId}
							onChange={(e) => setDraftId(e.target.value)}
							placeholder="音色 ID（voice_type），如 zh_male_..."
							spellCheck={false}
							autoComplete="off"
							autoFocus
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
								返回
							</Button>
							<span className="text-muted-foreground ml-auto text-[10px]">
								豆包任意 voice_type
							</span>
						</div>
					</div>
				) : (
					<>
						<div className="max-h-64 overflow-y-auto">
							{voices.map((v) => {
								const selected = settings.voiceId === v.id;
								const custom = isCustom(v.id);
								return (
									<div
										key={v.id}
										className={cn(
											"group flex items-center gap-2 rounded px-2 py-1.5",
											selected ? "bg-primary/10" : "hover:bg-muted",
										)}
									>
										<button
											type="button"
											title={v.desc}
											onClick={() => {
												setSetting({ key: "voiceId", value: v.id });
												setOpen(false);
											}}
											className="flex min-w-0 flex-1 items-center gap-2 text-left"
										>
											<VoiceAvatar name={v.name} hue={v.hue} />
											<span className="truncate text-xs font-medium">
												{v.name}
											</span>
											<span className="text-muted-foreground truncate text-[11px]">
												{custom ? v.style : `${v.genderLabel} · ${v.style}`}
											</span>
											{v.recommended ? (
												<span className="bg-primary/20 text-primary ml-auto shrink-0 rounded px-1 text-[10px]">
													推荐
												</span>
											) : null}
										</button>
										{selected ? (
											<HugeiconsIcon
												icon={Tick02Icon}
												className="text-primary size-3.5 shrink-0"
											/>
										) : null}
										{custom ? (
											<button
												type="button"
												title="删除该音色"
												onClick={() => remove(v.id)}
												className="text-muted-foreground hover:text-destructive hidden shrink-0 group-hover:block"
											>
												<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
											</button>
										) : null}
									</div>
								);
							})}
						</div>
						<div className="bg-border my-1 h-px" />
						<button
							type="button"
							onClick={() => setAdding(true)}
							className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors"
						>
							<HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
							添加音色（任意豆包 voice_type）
						</button>
					</>
				)}
			</PopoverContent>
		</Popover>
	);

	if (variant === "chip") return picker;

	return (
		<div className="space-y-1.5">
			<div className="text-muted-foreground text-xs font-medium">配音音色</div>
			{picker}
			{!settings.targetLang.startsWith("zh") ? (
				<p className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-500">
					预设音色为中文音色——目标语言是
					{languageByCode(settings.targetLang).label}
					时，建议「添加音色」填入适合该语言的豆包 voice_type。
				</p>
			) : null}
			{phase === "review" ? (
				<p className="text-muted-foreground text-[10px]">
					提示：在左侧句列表点 ▶ 可用当前音色试听单句。
				</p>
			) : null}
		</div>
	);
}
